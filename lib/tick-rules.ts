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

const MINUTE_MS = 60_000;
export const INTERVIEW_REMIND_BEFORE_MS = 5 * MINUTE_MS;
export const INTERVIEW_HEADSUP_AFTER_MS = 3 * 24 * HOUR_MS;
export const INTERVIEW_EXPIRE_AFTER_MS = 7 * 24 * HOUR_MS;
export const INTERVIEW_DONE_AFTER_MS = 60 * MINUTE_MS;
/** Voice-join notifies from this long before the booked start … */
export const INTERVIEW_JOIN_EARLY_MS = 15 * MINUTE_MS;
/** … to this long after it. */
export const INTERVIEW_JOIN_LATE_MS = 30 * MINUTE_MS;

export type TickInterview = {
  status: 'AWAITING_TIMES' | 'TIMES_RECEIVED' | 'PROPOSED' | 'BOOKED' | 'DONE' | 'CANCELLED' | 'NO_TIME' | 'CLOSED';
  requestedAt: Date;
  proposedStart: Date | null;
  bookedStart: Date | null;
  remindedAt: Date | null;
  headsUpAt: Date | null;
  joinedNotifiedAt: Date | null;
};

/** Step 9: five minutes before the start, never once it has begun (a late restart sends nothing). */
export function interviewReminderDue(i: TickInterview, now: Date): boolean {
  if (i.status !== 'BOOKED' || i.remindedAt !== null || !i.bookedStart) return false;
  const until = i.bookedStart.getTime() - now.getTime();
  return until > 0 && until <= INTERVIEW_REMIND_BEFORE_MS;
}

/** Step 10. */
export function interviewExpired(i: TickInterview, now: Date): boolean {
  return (i.status === 'AWAITING_TIMES' || i.status === 'TIMES_RECEIVED') && now.getTime() >= i.requestedAt.getTime() + INTERVIEW_EXPIRE_AFTER_MS;
}

/** Step 11. */
export function interviewHeadsUpDue(i: TickInterview, now: Date): boolean {
  return i.status === 'AWAITING_TIMES' && i.headsUpAt === null && now.getTime() >= i.requestedAt.getTime() + INTERVIEW_HEADSUP_AFTER_MS;
}

/** Step 12. */
export function proposalLapsed(i: TickInterview, now: Date): boolean {
  return i.status === 'PROPOSED' && i.proposedStart !== null && now.getTime() >= i.proposedStart.getTime();
}

/** Step 13. */
export function interviewDone(i: TickInterview, now: Date): boolean {
  return i.status === 'BOOKED' && i.bookedStart !== null && now.getTime() >= i.bookedStart.getTime() + INTERVIEW_DONE_AFTER_MS;
}

/** Voice-join: booked start from 15 minutes ahead to 30 minutes ago, not yet announced. */
export function joinNoticeDue(i: TickInterview, now: Date): boolean {
  if (i.status !== 'BOOKED' || i.joinedNotifiedAt !== null || !i.bookedStart) return false;
  const offset = i.bookedStart.getTime() - now.getTime();
  return offset <= INTERVIEW_JOIN_EARLY_MS && offset >= -INTERVIEW_JOIN_LATE_MS;
}
