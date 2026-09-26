/**
 * Time helpers built on Intl only. docs/01 § Time: no time is ever rendered alone, the
 * guild zone is one constant, and offsets are real (DST transitions differ by zone).
 */
import { GUILD_TIMEZONE } from '@/lib/config';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

const SHORT_DAYS: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: Weekday };

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
  let f = partFormatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    });
    partFormatters.set(zone, f);
  }
  return f;
}

/** Wall-clock parts of `date` as seen in `zone`. */
export function zonedParts(date: Date, zone: string): ZonedParts {
  const map: Record<string, string> = {};
  for (const p of partsFormatter(zone).formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: SHORT_DAYS[map.weekday],
  };
}

/** Offset of `zone` from UTC at `date`, in milliseconds (positive east of UTC). */
export function tzOffsetMs(date: Date, zone: string): number {
  const p = zonedParts(date, zone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const utc = Math.floor(date.getTime() / 1000) * 1000;
  return wall - utc;
}

/**
 * The instant at which `zone`'s clocks read the given wall time.
 *
 * DST edges: a wall time that does not exist (the spring-forward gap) is moved forward
 * past the gap, so 02:30 on a day the clocks jump 02:00→03:00 becomes 03:30. A wall time
 * that occurs twice (the fall-back hour) resolves to the earlier instant.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, zone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes handle a DST boundary between the guess and the answer.
  let utc = guess - tzOffsetMs(new Date(guess), zone);
  utc = guess - tzOffsetMs(new Date(utc), zone);
  // In a gap the clocks never read the requested time; the result lands before the gap.
  // Add the shortfall so it lands after it instead.
  const back = zonedParts(new Date(utc), zone);
  const got = Date.UTC(back.year, back.month - 1, back.day, back.hour, back.minute);
  if (got !== guess) utc += guess - got;
  return new Date(utc);
}

export function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Bad time "${hhmm}", expected HH:MM`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) throw new Error(`Bad time "${hhmm}", hour must be 0–23 and minute 0–59`);
  return { hour, minute };
}

/**
 * The next instant (at or after `from`) when it is `hhmm` on `weekday` in `zone`.
 * Walks the zone's own calendar, so the answer is right across DST changes.
 */
export function nextOccurrence(weekday: Weekday, hhmm: string, zone: string = GUILD_TIMEZONE, from: Date = new Date()): Date {
  const today = zonedParts(from, zone);
  const { hour, minute } = parseHHMM(hhmm);
  for (let add = 0; add <= 7; add++) {
    const cal = new Date(Date.UTC(today.year, today.month - 1, today.day + add));
    if (cal.getUTCDay() !== weekday) continue;
    const candidate = zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), hour, minute, zone);
    if (candidate.getTime() >= from.getTime()) return candidate;
  }
  throw new Error('unreachable: a weekday recurs within eight days');
}

/** "8:00 PM" in `zone`. `withPeriod: false` drops the AM/PM. */
export function formatClock(date: Date, zone: string, withPeriod = true): string {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
  return withPeriod ? s.replace(' ', ' ') : s.replace(/\s*[AP]M$/i, '');
}

export function periodOf(date: Date, zone: string): 'AM' | 'PM' {
  return zonedParts(date, zone).hour < 12 ? 'AM' : 'PM';
}

/** "8:00 – 11:00 PM", or "11:00 AM – 1:00 PM" when the range crosses noon. */
export function formatRange(start: Date, end: Date, zone: string): string {
  const same = periodOf(start, zone) === periodOf(end, zone);
  return `${formatClock(start, zone, !same)} – ${formatClock(end, zone)}`;
}

/** Guild wall time as text, no date needed: "20:00" → "8:00 PM". */
export function formatGuildClock(hhmm: string, withPeriod = true): string {
  const { hour, minute } = parseHHMM(hhmm);
  const d = new Date(Date.UTC(2026, 0, 4, hour, minute));
  return formatClock(d, 'UTC', withPeriod);
}

export function formatGuildRange(startHHMM: string, endHHMM: string): string {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  const same = s.hour < 12 === e.hour < 12;
  return `${formatGuildClock(startHHMM, !same)} – ${formatGuildClock(endHHMM)}`;
}

/** "8 PM" / "8:30 PM": like formatClock but drops ":00". Week-strip cells use this. */
export function formatClockShort(date: Date, zone: string, withPeriod = true): string {
  return formatClock(date, zone, withPeriod).replace(/:00(?=\s|$)/, '');
}

/** "8 – 11 PM", or "11 AM – 1 PM" across noon. */
export function formatRangeShort(start: Date, end: Date, zone: string): string {
  const same = periodOf(start, zone) === periodOf(end, zone);
  return `${formatClockShort(start, zone, !same)} – ${formatClockShort(end, zone)}`;
}

export function formatGuildRangeShort(startHHMM: string, endHHMM: string): string {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  const same = s.hour < 12 === e.hour < 12;
  const short = (clock: string) => clock.replace(/:00(?=\s|$)/, '');
  return `${short(formatGuildClock(startHHMM, !same))} – ${short(formatGuildClock(endHHMM))}`;
}

/**
 * Minutes from one guild wall time to the next occurrence of another, e.g. "20:00" →
 * "23:00" = 180. A range that crosses midnight ("23:00" → "01:00") is 120, not negative.
 */
export function minutesBetween(startHHMM: string, endHHMM: string): number {
  const s = parseHHMM(startHHMM);
  const e = parseHHMM(endHHMM);
  const diff = e.hour * 60 + e.minute - (s.hour * 60 + s.minute);
  return diff < 0 ? diff + 24 * 60 : diff;
}

/** "UTC−5", "UTC+1", "UTC+5:30", "UTC+0" for `zone` at `date`. Uses a real minus sign. */
export function formatUtcOffset(date: Date, zone: string): string {
  const minutes = Math.round(tzOffsetMs(date, zone) / 60_000);
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}

/** "CDT", "PDT", "GMT+1" for `zone` at `date`. */
export function zoneAbbreviation(date: Date, zone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? zone;
}

/** The viewer's IANA zone. Falls back to UTC where Intl cannot say. */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
