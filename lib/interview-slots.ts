/**
 * The one interview slot rule (SYNC-SPEC §12, Time rules). Slots are half-hour starts from
 * 9:00 AM to 10:30 PM guild time, every day, and are handled as absolute instants. Every
 * interview action checks its time here, so the page, the officer card and the bot agree.
 */
import { GUILD_TIMEZONE, INTERVIEW_FIRST_START_MIN, INTERVIEW_LAST_START_MIN } from '@/lib/config';
import { zonedParts, zonedTimeToUtc } from '@/lib/time';

export const SLOT_MS = 30 * 60_000;
/** Picks and proposals start at least this far ahead of the request or proposal. */
export const LEAD_MS = 2 * 60 * 60_000;
/** ...and at most this far. */
export const REACH_MS = 7 * 24 * 60 * 60_000;
/** Booking a time or accepting a proposal needs the start at least this far away. */
export const MIN_NOTICE_MS = 15 * 60_000;

/**
 * What a start is checked for: an applicant's pick within the interview's window, an officer's
 * proposal made at `now`, or booking a time (or accepting a proposal) at `now`.
 */
export type SlotPurpose =
  | { kind: 'pick'; windowStart: Date; windowEnd: Date }
  | { kind: 'propose'; now: Date }
  | { kind: 'book'; now: Date };

// Guild time is a whole number of hours from UTC, so its half hours are UTC's half hours.
const roundUp = (ms: number) => Math.ceil(ms / SLOT_MS) * SLOT_MS;
const roundDown = (ms: number) => Math.floor(ms / SLOT_MS) * SLOT_MS;

/** The applicant's pick window: requestedAt + 2 h to requestedAt + 7 d, rounded inward to the half hour. */
export function pickWindow(requestedAt: Date): { windowStart: Date; windowEnd: Date } {
  const t = requestedAt.getTime();
  return { windowStart: new Date(roundUp(t + LEAD_MS)), windowEnd: new Date(roundDown(t + REACH_MS)) };
}

/** Where proposals made at `now` may fall: now + 2 h to now + 7 d. */
export function proposalRange(now: Date): { from: Date; to: Date } {
  return { from: new Date(now.getTime() + LEAD_MS), to: new Date(now.getTime() + REACH_MS) };
}

/** Is `instant` one of the 28 daily half-hour starts in guild time? */
export function isSlotStart(instant: Date): boolean {
  const t = instant.getTime();
  if (!Number.isFinite(t) || t % 1000 !== 0) return false;
  const p = zonedParts(instant, GUILD_TIMEZONE);
  const minute = p.hour * 60 + p.minute;
  return p.second === 0 && p.minute % 30 === 0 && minute >= INTERVIEW_FIRST_START_MIN && minute <= INTERVIEW_LAST_START_MIN;
}

/** Is `instant` a valid start for this purpose? Window edges are included. */
export function isValidStart(instant: Date, purpose: SlotPurpose): boolean {
  if (!isSlotStart(instant)) return false;
  const t = instant.getTime();
  switch (purpose.kind) {
    case 'pick':
      return t >= purpose.windowStart.getTime() && t <= purpose.windowEnd.getTime();
    case 'propose': {
      const { from, to } = proposalRange(purpose.now);
      return t >= from.getTime() && t <= to.getTime();
    }
    case 'book':
      return t - purpose.now.getTime() >= MIN_NOTICE_MS;
  }
}

/** Every slot start from `from` to `to`, both included, in order. */
export function slotStartsBetween(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  if (!(from.getTime() <= to.getTime())) return out;
  const first = zonedParts(from, GUILD_TIMEZONE);
  // Walk guild calendar days, so each day gets its 28 wall-clock starts whatever the offset.
  for (let add = 0; ; add++) {
    const day = new Date(Date.UTC(first.year, first.month - 1, first.day + add));
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    if (zonedTimeToUtc(y, m, d, 0, 0, GUILD_TIMEZONE).getTime() > to.getTime()) return out;
    for (let min = INTERVIEW_FIRST_START_MIN; min <= INTERVIEW_LAST_START_MIN; min += 30) {
      const start = zonedTimeToUtc(y, m, d, Math.floor(min / 60), min % 60, GUILD_TIMEZONE);
      if (start.getTime() >= from.getTime() && start.getTime() <= to.getTime()) out.push(start);
    }
  }
}

/** The starts an applicant can pick: every slot in the interview's window that hasn't started yet. */
export function pickerStarts(requestedAt: Date, now: Date): Date[] {
  const { windowStart, windowEnd } = pickWindow(requestedAt);
  return slotStartsBetween(windowStart, windowEnd).filter((start) => start.getTime() > now.getTime());
}
