/**
 * What `tick` decides (SYNC-SPEC §6), as pure predicates over a raid's fields and `now`.
 * The database work in lib/tick.ts applies them.
 */
import { GUILD_TIMEZONE } from '@/lib/config';
import { zonedParts, zonedTimeToUtc } from '@/lib/time';

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

/** Application reminders (step 14): the attempt fields the activity time and line read. */
export type ReminderInterview = {
  attempt: number;
  status: TickInterview['status'];
  requestedAt: Date;
  timesUpdatedAt: Date | null;
  proposedAt: Date | null;
  bookedAt: Date | null;
  bookedStart: Date | null;
  endedAt: Date | null;
};

export type ReminderApplication<I extends ReminderInterview = ReminderInterview> = {
  createdAt: Date;
  reopenedAt: Date | null;
  /** Every officer note, soft-deleted ones included; edits don't count, so only `createdAt` is read. */
  notes: { createdAt: Date }[];
  interviews: I[];
};

export type ReminderLine = 'booking_owed' | 'time_passed' | 'no_time' | 'cancelled' | 'waiting';

/** The latest attempt is the highest `attempt`, whatever order the rows come in. */
export function latestAttempt<I extends ReminderInterview>(interviews: I[]): I | null {
  return interviews.reduce<I | null>((latest, i) => (latest === null || i.attempt > latest.attempt ? i : latest), null);
}

/** The latest of creation, reopen, every note's creation and the latest attempt's timestamps. */
export function reminderActivityTime(app: ReminderApplication): Date {
  const latest = latestAttempt(app.interviews);
  const times = [app.createdAt, app.reopenedAt, ...app.notes.map((n) => n.createdAt), latest?.requestedAt, latest?.timesUpdatedAt, latest?.proposedAt, latest?.bookedAt, latest?.endedAt];
  return new Date(Math.max(...times.filter((t): t is Date => t instanceof Date).map((t) => t.getTime())));
}

/** While the latest attempt waits on the applicant or a booked time, the interview flow owns the thread. */
export function reminderQuiet(app: ReminderApplication): boolean {
  const status = latestAttempt(app.interviews)?.status;
  return status === 'AWAITING_TIMES' || status === 'PROPOSED' || status === 'BOOKED';
}

/** Which line the reminder shows and the time it names; null while quiet. */
export function reminderLine(app: ReminderApplication): { line: ReminderLine; at: Date } | null {
  if (reminderQuiet(app)) return null;
  const activity = reminderActivityTime(app);
  const latest = latestAttempt(app.interviews);
  // An attempt that ended before the latest reopen is history.
  if (!latest || latest.status === 'CLOSED' || (latest.endedAt && app.reopenedAt && latest.endedAt < app.reopenedAt)) return { line: 'waiting', at: activity };
  if (latest.status === 'TIMES_RECEIVED') return { line: 'booking_owed', at: latest.timesUpdatedAt ?? activity };
  if (latest.status === 'DONE') return { line: 'time_passed', at: latest.bookedStart ?? activity };
  if (latest.status === 'NO_TIME') return { line: 'no_time', at: latest.endedAt ?? activity };
  return { line: 'cancelled', at: latest.endedAt ?? activity };
}

/** The Pacific calendar day of an instant, "YYYY-MM-DD" (the format of `reminderTriedOn` and `reminderLastOn`). */
export function pacificDay(at: Date): string {
  const p = zonedParts(at, GUILD_TIMEZONE);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** `day` moved back by whole calendar days, so DST never shifts it. */
function daysBefore(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

export type ReminderSchedule = {
  status: string;
  reminderTriedOn: string | null;
  reminderCount: number;
  reminderActivityAt: Date | null;
  reminderLastOn: string | null;
};

export const REMINDER_HOUR = 17;
const REMINDER_QUIET_AFTER_MS = 24 * HOUR_MS;

/** Step 14: is a reminder due for this application now? Only from 5 PM to midnight Pacific. */
export function applicationReminderDue(app: ReminderApplication & ReminderSchedule, now: Date): boolean {
  if (app.status !== 'PENDING' || reminderQuiet(app)) return false;
  const p = zonedParts(now, GUILD_TIMEZONE);
  if (p.hour < REMINDER_HOUR) return false;
  const today = pacificDay(now);
  if (app.reminderTriedOn === today) return false;
  const activity = reminderActivityTime(app);
  const fivePm = zonedTimeToUtc(p.year, p.month, p.day, REMINDER_HOUR, 0, GUILD_TIMEZONE);
  if (activity.getTime() > fivePm.getTime() - REMINDER_QUIET_AFTER_MS) return false;
  // Counts belong to the activity time they were made under; new activity restarts them.
  const n = app.reminderActivityAt?.getTime() === activity.getTime() ? app.reminderCount : 0;
  if (n === 0) return true;
  if (app.reminderLastOn === null) return true;
  return app.reminderLastOn <= daysBefore(today, n < 3 ? 1 : 3);
}
