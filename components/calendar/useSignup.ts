'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Role } from '@/lib/design/class-colors';
import type { RemovedReserve } from '@/lib/character-switch';
import type { Character } from '@/lib/generated/prisma/client';
import { SAVE_FAILED } from '@/content/calendar';
import { applyResponse, mergeLocal, signupRoleFor, type LocalAnswer, type RaidCard, type RaidResponse, type RoleCounts } from '@/lib/raids';

type Result = { raidId: string; userId: string; response: RaidResponse | null; characterId?: string | null; counts: RoleCounts };
/** The character the member picked in the question: sent with a first Accept or Tentative; `role` feeds the optimistic counts only. */
export type CharacterChoice = { characterId: string; role: Role; makeDefault: boolean };
type SwitchCharacter = Pick<Character, 'id' | 'name' | 'class' | 'spec' | 'raidRole'>;
export type CharacterSwitchResult =
  | { ok: true; character: SwitchCharacter; removed: RemovedReserve[] }
  | { ok: false; status: number | null; error: string };

/** A refusal from the route; `reason` is its message when it sent one. */
class Refused extends Error {
  constructor(readonly reason?: string) { super(reason ?? 'refused'); }
}

/** Bench acceptances never contribute to the composition bars. */
function withRole(raid: RaidCard, role: Role | null, mainRole: Role | null): LocalAnswer {
  const counts = raid.onRoster === false ? raid.counts
    : applyResponse(applyResponse(raid.counts, signupRoleFor(raid, mainRole), raid.mine, null), role, null, raid.mine);
  return { mine: raid.mine, counts, signupRole: role };
}

/**
 * Optimistic raid sign-ups (docs/04 § Sign-up confirmation). Answering updates the row at
 * once and writes in the background; the server's counts replace the guess when they
 * land, and a failed write reverts the row. `undo(id)` restores the answer before the
 * last change; `onResult` hears whether an answer was that undo. One request per raid at a time: a newer answer supersedes an in-flight one
 * by ignoring its reply.
 */
export function useSignup(initial: RaidCard[], viewerRole: Role | null, onResult: (ok: boolean, raid: RaidCard, response: RaidResponse | null, undo: () => void, undone: boolean, error?: string) => void) {
  // The server's cards stay the base and only the viewer's answers ride on top, so a
  // refreshed page (a raid scheduled, another member's answer) shows up without losing
  // the optimistic state.
  const [local, setLocal] = useState(new Map<string, LocalAnswer>());
  const raids = useMemo(() => mergeLocal(initial, local), [initial, local]);
  const setRaid = useCallback((id: string, value: LocalAnswer) => setLocal((m) => new Map(m).set(id, value)), []);
  // A character write is exclusive with answer writes on the same raid. Callers can
  // disable controls with pending; refs also guard clicks before React renders again.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const busy = useRef(new Set<string>());
  const switching = useRef(new Set<string>());
  const markPending = useCallback((id: string, value: boolean) => {
    if (value) busy.current.add(id); else busy.current.delete(id);
    setPending(new Set(busy.current));
  }, []);
  // A default the member set in the question: later answers in this visit must not ask again.
  const [madeDefault, setMadeDefault] = useState<string | null>(null);
  const previous = useRef(new Map<string, RaidResponse | null>());
  const inflight = useRef(new Map<string, number>());
  /** Per-raid promise chain so writes reach the server in click order. */
  const queue = useRef(new Map<string, Promise<void>>());
  // undo() runs from a toast created by respond(), and respond() hands undo to the toast:
  // the ref breaks that cycle without either closing over a stale version of the other.
  const respondRef = useRef<(id: string, response: RaidResponse | null, remember?: boolean, choice?: CharacterChoice) => void>(() => {});

  const undo = useCallback((id: string) => {
    if (!previous.current.has(id) || switching.current.has(id)) return;
    const back = previous.current.get(id) ?? null;
    previous.current.delete(id);
    respondRef.current(id, back, false);
  }, []);

  const respond = useCallback(
    (id: string, response: RaidResponse | null, remember = true, choice?: CharacterChoice) => {
      const before = raids.find((r) => r.id === id);
      if (!before || before.mine === response || switching.current.has(id)) return;
      if (remember) previous.current.set(id, before.mine);

      const signupRole = choice ? choice.role : before.signupRole;
      setRaid(id, { mine: response, signupRole, counts: applyResponse(before.counts, choice && before.onRoster !== false ? choice.role : signupRoleFor(before, viewerRole), before.mine, response) });
      markPending(id, true);

      const seq = (inflight.current.get(id) ?? 0) + 1;
      inflight.current.set(id, seq);
      // Two quick answers on one raid must not race on the server: the second PUT waits
      // for the first to settle, so the stored row always matches the last click.
      const run = (queue.current.get(id) ?? Promise.resolve())
        .then(() =>
          fetch(`/api/raids/${id}/signup`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(choice ? { response, characterId: choice.characterId, ...(choice.makeDefault && { makeDefault: true }) } : { response }),
            credentials: 'same-origin',
          }),
        )
        .then(async (res) => {
          if (res.ok) return res.json() as Promise<Result>;
          // The route's own message (a lock, a deleted character) reaches the caller's toast.
          const body = await res.json().catch(() => null) as { error?: unknown } | null;
          throw new Refused(typeof body?.error === 'string' ? body.error : undefined);
        })
        .then((result) => {
          if (inflight.current.get(id) !== seq) return;
          setRaid(id, { mine: result.response, signupRole, counts: result.counts });
          if (choice?.makeDefault) setMadeDefault(choice.characterId);
          onResult(true, before, response, () => undo(id), !remember);
        })
        .catch((error: unknown) => {
          if (inflight.current.get(id) !== seq) return;
          setRaid(id, { mine: before.mine, signupRole: before.signupRole, counts: before.counts });
          onResult(false, before, response, () => undo(id), !remember, error instanceof Refused ? error.reason : undefined);
        })
        .finally(() => { if (inflight.current.get(id) === seq) markPending(id, false); });
      queue.current.set(id, run);
    },
    [raids, viewerRole, onResult, undo, setRaid, markPending],
  );

  useEffect(() => {
    respondRef.current = respond;
  }, [respond]);

  /** The caller supplies the selected character's role for the optimistic counts.
   * Refusals retain the HTTP status and server copy for the caller's lock/error UI.
   * While any write is pending on this raid, a switch is refused locally, not queued.
   */
  const switchCharacter = useCallback(async (id: string, characterId: string, role: Role): Promise<CharacterSwitchResult> => {
    const before = raids.find((r) => r.id === id);
    if (!before || busy.current.has(id)) return { ok: false, status: null, error: SAVE_FAILED };
    switching.current.add(id);
    markPending(id, true);
    const rollback: LocalAnswer = { mine: before.mine, counts: before.counts, signupRole: before.signupRole };
    setRaid(id, withRole(before, role, viewerRole));
    try {
      const res = await fetch(`/api/raids/${id}/signup/character`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }), credentials: 'same-origin',
      });
      const result = await res.json().catch(() => null) as { character: SwitchCharacter; removed: RemovedReserve[]; error?: string } | null;
      if (!res.ok) {
        setRaid(id, rollback);
        return { ok: false, status: res.status, error: result?.error ?? SAVE_FAILED };
      }
      if (!result) throw new Error('Missing character switch result');
      setRaid(id, withRole(before, result.character.raidRole.toLowerCase() as Role, viewerRole));
      return { ok: true, character: result.character, removed: result.removed };
    } catch {
      setRaid(id, rollback);
      return { ok: false, status: null, error: SAVE_FAILED };
    } finally {
      switching.current.delete(id);
      markPending(id, false);
    }
  }, [raids, viewerRole, setRaid, markPending]);

  return { raids, respond, undo, switchCharacter, pending, madeDefault };
}
