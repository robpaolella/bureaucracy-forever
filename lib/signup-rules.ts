/**
 * Sign-up rules (SYNC-SPEC §7). The site enforces them for both surfaces; the bot only
 * shows the `reason` it is given. Pure, so every branch is unit-tested.
 */
import type { RaidResponse } from '@/lib/raids';

export type Standing = 'ROSTER' | 'BENCH';
export type RaidState = { status: 'SCHEDULED' | 'LOCKED' | 'DONE' | 'CANCELLED'; locksAt: Date };
export type Actor = { role: 'social' | 'member' | 'officer' };
export type Existing = { standing: Standing; response: RaidResponse | null } | null;
export type Outcome = { ok: true; standing: Standing; response: RaidResponse } | { ok: false; status: 403 | 409; reason: string };

export const REASONS = {
  social: 'The calendar is view-only for social members.',
  cancelled: 'This raid was cancelled.',
  done: 'This raid has already happened.',
  locked: 'Sign-ups are locked. Officers can still change answers on the web.',
  notOnRoster: "You're not on this roster.",
  alreadyRoster: "You're already on the roster.",
};

function closed(raid: RaidState, now: Date, officerOverride: boolean): Outcome | null {
  if (raid.status === 'CANCELLED') return { ok: false, status: 409, reason: REASONS.cancelled };
  if (raid.status === 'DONE') return { ok: false, status: 409, reason: REASONS.done };
  if ((raid.status === 'LOCKED' || now.getTime() >= raid.locksAt.getTime()) && !officerOverride) return { ok: false, status: 409, reason: REASONS.locked };
  return null;
}

/**
 * Accept / Tentative / Absent. A roster member sets their answer; anyone else who accepts
 * or is tentative lands on the bench with that answer; declining while not on the roster
 * does nothing. `officerOverride` is an officer answering for someone on the web, which
 * the lock does not stop.
 */
export function decideRespond(actor: Actor, raid: RaidState, existing: Existing, response: RaidResponse, now: Date, officerOverride = false): Outcome {
  if (actor.role === 'social') return { ok: false, status: 403, reason: REASONS.social };
  const stop = closed(raid, now, officerOverride);
  if (stop) return stop;
  if (existing?.standing === 'ROSTER') return { ok: true, standing: 'ROSTER', response };
  if (response === 'absent') return { ok: false, status: 409, reason: REASONS.notOnRoster };
  return { ok: true, standing: 'BENCH', response };
}

/** "Join bench": bench + accept. Roster members are already in. */
export function decideBench(actor: Actor, raid: RaidState, existing: Existing, now: Date): Outcome {
  if (actor.role === 'social') return { ok: false, status: 403, reason: REASONS.social };
  const stop = closed(raid, now, false);
  if (stop) return stop;
  if (existing?.standing === 'ROSTER') return { ok: false, status: 409, reason: REASONS.alreadyRoster };
  return { ok: true, standing: 'BENCH', response: 'accept' };
}

/** Composition bars count roster acceptances only (§7). */
export function countsForBars(rows: { standing: Standing; response: RaidResponse | null; role: string | null }[]): Record<string, number> {
  const out: Record<string, number> = { tank: 0, healer: 0, melee: 0, ranged: 0 };
  for (const r of rows) if (r.standing === 'ROSTER' && r.response === 'accept' && r.role && r.role in out) out[r.role] += 1;
  return out;
}
