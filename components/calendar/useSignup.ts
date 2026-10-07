'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Role } from '@/lib/design/class-colors';
import type { RemovedReserve } from '@/lib/character-switch';
import type { Character } from '@/lib/generated/prisma/client';
import { SAVE_FAILED } from '@/content/calendar';
import { applyResponse, mergeLocal, signupRoleFor, type LocalAnswer, type RaidCard, type RaidResponse, type RoleCounts } from '@/lib/raids';

type Result = { raidId: string; userId: string; response: RaidResponse | null; counts: RoleCounts };
type SwitchCharacter = Pick<Character, 'id' | 'name' | 'class' | 'spec' | 'raidRole'>;
export type CharacterSwitchResult =
  | { ok: true; character: SwitchCharacter; removed: RemovedReserve[] }
  | { ok: false; status: number | null; error: string };

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
export function useSignup(initial: RaidCard[], viewerRole: Role | null, onResult: (ok: boolean, raid: RaidCard, response: RaidResponse | null, undo: () => void, undone: boolean) => void) {
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
  const previous = useRef(new Map<string, RaidResponse | null>());
  const inflight = useRef(new Map<string, number>());
  /** Per-raid promise chain so writes reach the server in click order. */
  const queue = useRef(new Map<string, Promise<void>>());
  // undo() runs from a toast created by respond(), and respond() hands undo to the toast:
  // the ref breaks that cycle without either closing over a stale version of the other.
  const respondRef = useRef<(id: string, response: RaidResponse | null, remember?: boolean) => void>(() => {});

  const undo = useCallback((id: string) => {
    if (!previous.current.has(id)) return;
    const back = previous.current.get(id) ?? null;
    previous.current.delete(id);
    respondRef.current(id, back, false);
  }, []);

  const respond = useCallback(
    (id: string, response: RaidResponse | null, remember = true) => {
      const before = raids.find((r) => r.id === id);
      if (!before || before.mine === response || switching.current.has(id)) return;
      if (remember) previous.current.set(id, before.mine);

      const signupRole = signupRoleFor(before, viewerRole);
      setRaid(id, { mine: response, signupRole, counts: applyResponse(before.counts, signupRole, before.mine, response) });
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
            body: JSON.stringify({ response }),
            credentials: 'same-origin',
          }),
        )
        .then((res) => (res.ok ? (res.json() as Promise<Result>) : Promise.reject(new Error(String(res.status)))))
        .then((result) => {
          if (inflight.current.get(id) !== seq) return;
          setRaid(id, { mine: result.response, signupRole, counts: result.counts });
          onResult(true, before, response, () => undo(id), !remember);
        })
        .catch(() => {
          if (inflight.current.get(id) !== seq) return;
          setRaid(id, { mine: before.mine, signupRole: before.signupRole, counts: before.counts });
          onResult(false, before, response, () => undo(id), !remember);
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
      const result = await res.json() as { character: SwitchCharacter; removed: RemovedReserve[]; error?: string };
      if (!res.ok) {
        setRaid(id, rollback);
        return { ok: false, status: res.status, error: result.error ?? SAVE_FAILED };
      }
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

  return { raids, respond, undo, switchCharacter, pending };
}
