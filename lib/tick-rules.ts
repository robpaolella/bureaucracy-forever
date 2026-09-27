/**
 * What `tick` decides (SYNC-SPEC §6), as pure predicates over a raid's fields and `now`.
 * The database work in lib/tick.ts applies them.
 */
export const HOUR_MS = 3_600_000;
export const CLOSE_GRACE_MS = 60 * 60_000;
export const NUDGE_AFTER_MS = 24 * HOUR_MS;
export const RECONCILE_EVERY_MS = HOUR_MS;

export type TickRaid = {
  status: 'SCHEDULED' | 'LOCKED' | 'DONE' | 'CANCELLED';
  startsAt: Date;
  durationMin: number;
  locksAt: Date;
  postedAt: Date | null;
  remind72At: Date | null;
  remind24At: Date | null;
};

/** Step 2: an unposted, still scheduled raid inside the post-ahead window. */
export function dueForPost(raid: TickRaid, now: Date, postAheadDays: number): boolean {
  return raid.postedAt === null && raid.status === 'SCHEDULED' && raid.startsAt.getTime() > now.getTime() && raid.startsAt.getTime() - now.getTime() <= postAheadDays * 24 * HOUR_MS;
}

/** Step 3: which reminder, if any, is due for a posted, unlocked raid. */
export function reminderDue(raid: TickRaid, now: Date): 72 | 24 | null {
  if (raid.postedAt === null || raid.status !== 'SCHEDULED') return null;
  const until = raid.startsAt.getTime() - now.getTime();
  if (until <= 0) return null;
  if (until <= 24 * HOUR_MS && raid.remind24At === null) return 24;
  if (until <= 72 * HOUR_MS && raid.remind72At === null) return 72;
  return null;
}

/** Step 4. */
export function dueForLock(raid: TickRaid, now: Date): boolean {
  return raid.status === 'SCHEDULED' && now.getTime() >= raid.locksAt.getTime();
}

/** Step 5: an hour after the night ends. */
export function dueForClose(raid: TickRaid, now: Date): boolean {
  return raid.status === 'LOCKED' && now.getTime() >= raid.startsAt.getTime() + raid.durationMin * 60_000 + CLOSE_GRACE_MS;
}

/** Step 6. */
export function dueForNudge(app: { status: string; createdAt: Date; nudgedAt: Date | null }, now: Date): boolean {
  return app.status === 'PENDING' && app.nudgedAt === null && now.getTime() - app.createdAt.getTime() > NUDGE_AFTER_MS;
}
