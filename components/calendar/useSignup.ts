'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '@/lib/design/class-colors';
import { applyResponse, type RaidCard, type RaidResponse, type RoleCounts } from '@/lib/raids';

type Result = { raidId: string; mine: RaidResponse | null; counts: RoleCounts };

/**
 * Optimistic raid sign-ups (docs/04 § Sign-up confirmation). Answering updates the row at
 * once and writes in the background; the server's counts replace the guess when they
 * land, and a failed write reverts the row. `undo(id)` restores the answer before the
 * last change. One request per raid at a time: a newer answer supersedes an in-flight one
 * by ignoring its reply.
 */
export function useSignup(initial: RaidCard[], viewerRole: Role | null, onResult: (ok: boolean, raid: RaidCard, response: RaidResponse | null, undo: () => void) => void) {
  const [raids, setRaids] = useState(initial);
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
      if (!before || before.mine === response) return;
      if (remember) previous.current.set(id, before.mine);

      setRaids((list) => list.map((r) => (r.id === id ? { ...r, mine: response, counts: applyResponse(r.counts, viewerRole, r.mine, response) } : r)));

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
          setRaids((list) => list.map((r) => (r.id === id ? { ...r, mine: result.mine, counts: result.counts } : r)));
          onResult(true, before, response, () => undo(id));
        })
        .catch(() => {
          if (inflight.current.get(id) !== seq) return;
          setRaids((list) => list.map((r) => (r.id === id ? { ...r, mine: before.mine, counts: before.counts } : r)));
          onResult(false, before, response, () => undo(id));
        });
      queue.current.set(id, run);
    },
    [raids, viewerRole, onResult, undo],
  );

  useEffect(() => {
    respondRef.current = respond;
  }, [respond]);

  return { raids, respond, undo };
}
