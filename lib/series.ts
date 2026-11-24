/**
 * Raid series → raid instances (SYNC-SPEC §3 RaidSeries, §6 step 1). A series is a weekday
 * and a wall-clock time in the guild zone; each occurrence is computed on that calendar
 * date with zonedTimeToUtc, which is what keeps 8 PM at 8 PM across the DST change.
 */
import { GUILD_TIMEZONE } from '@/lib/config';
import { parseHHMM, zonedParts, zonedTimeToUtc, type Weekday } from '@/lib/time';

export type SeriesShape = { weekday: number; startTime: string; horizonWeeks: number };

export const ROSTER_RANKS = ['RAIDER', 'TRIAL', 'OFFICER'] as const;
export type RosterRank = (typeof ROSTER_RANKS)[number];

export function isRosterRank(rank: string): rank is RosterRank {
  return (ROSTER_RANKS as readonly string[]).includes(rank);
}

/**
 * Every start instant for the series from `from` (inclusive) through `horizonWeeks` weeks
 * ahead, ascending. Walks the guild zone's own calendar day by day so the weekday and the
 * wall clock are judged where the guild lives, never in UTC.
 */
export function occurrences(series: SeriesShape, from: Date, zone: string = GUILD_TIMEZONE): Date[] {
  const { hour, minute } = parseHHMM(series.startTime);
  const start = zonedParts(from, zone);
  const out: Date[] = [];
  const days = series.horizonWeeks * 7;
  for (let add = 0; add <= days; add++) {
    // Date.UTC on the zone's own y/m/d gives a stable calendar cursor; the hour is irrelevant here.
    const cal = new Date(Date.UTC(start.year, start.month - 1, start.day + add));
    if (cal.getUTCDay() !== (series.weekday as Weekday)) continue;
    const at = zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), hour, minute, zone);
    if (at.getTime() >= from.getTime()) out.push(at);
  }
  return out;
}

/** "2026-11-19": the guild calendar date an instant falls on. A series has one raid per date. */
export function guildDateKey(date: Date, zone: string = GUILD_TIMEZONE): string {
  const p = zonedParts(date, zone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Which occurrences have no raid yet, by guild date (§6 step 1: "skip dates that already
 * have a raid for the series"). Matching by instant would regenerate a raid whose time was
 * moved, next to the one that moved. `skipped` holds the guild dates whose raid an officer
 * deleted, so a deleted instance stays deleted.
 */
export function missingOccurrences(wanted: Date[], existing: Date[], skipped: readonly string[] = [], zone: string = GUILD_TIMEZONE): Date[] {
  const have = new Set([...existing.map((d) => guildDateKey(d, zone)), ...skipped]);
  return wanted.filter((d) => !have.has(guildDateKey(d, zone)));
}

/**
 * The series' occurrence in the same guild week (Sunday to Saturday) as `startsAt`: where an
 * existing instance lands when "this and future raids" changes the weekday or the time.
 */
export function occurrenceInWeekOf(startsAt: Date, series: Pick<SeriesShape, 'weekday' | 'startTime'>, zone: string = GUILD_TIMEZONE): Date {
  const { hour, minute } = parseHHMM(series.startTime);
  const p = zonedParts(startsAt, zone);
  const cal = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday + series.weekday));
  return zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), hour, minute, zone);
}

/**
 * The guild dates to skip when an officer deletes a series instance: the date it sits on,
 * and the series' own occurrence in that guild week. An instance edited onto another day
 * still stands for its week's slot, and tick matches slots by date, so both are needed.
 */
export function skippedDatesFor(startsAt: Date, series: Pick<SeriesShape, 'weekday' | 'startTime'>, zone: string = GUILD_TIMEZONE): string[] {
  return [...new Set([guildDateKey(startsAt, zone), guildDateKey(occurrenceInWeekOf(startsAt, series, zone), zone)])];
}

/**
 * "Molten Core — Thu Oct 15", or "Upper Blackrock Spire: Key Run — Tue Nov 24" with a title
 * addition: the post title and the raid name for every raid, one-off or generated.
 */
export function instanceName(templateName: string, startsAt: Date, addition: string | null = null, zone: string = GUILD_TIMEZONE): string {
  const p = zonedParts(startsAt, zone);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.weekday];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.month - 1];
  return `${titleBase(templateName, addition)} — ${day} ${month} ${p.day}`;
}

/** "Upper Blackrock Spire: Key Run": the title without its date, as the forms' hint shows it. */
export function titleBase(templateName: string, addition: string | null): string {
  return addition ? `${templateName}: ${addition}` : templateName;
}

export const TITLE_ADDITION_MAX = 40;
/** Discord's thread-name limit; the thread is named like the raid. */
export const RAID_NAME_MAX = 100;
/** " — Wed Sep 30", the longest date part a name can end with. */
const LONGEST_DATE = 13;

/**
 * A title addition as officers type it: trimmed, inner spaces collapsed, 1–40 characters on
 * one line. Empty or blank (or null) means none. Shared by the forms and the routes.
 */
export function parseTitleAddition(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, error: 'The title addition must be text.' };
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(value.trim())) return { ok: false, error: 'Keep the title addition on one line.' };
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text) return { ok: true, value: null };
  if ([...text].length > TITLE_ADDITION_MAX) return { ok: false, error: `Keep the title addition to ${TITLE_ADDITION_MAX} characters.` };
  return { ok: true, value: text };
}

/**
 * The whole name must fit Discord's thread name. A raid checks its own date; a series, with
 * no date yet, checks the longest one so none of its raids can overflow.
 */
export function raidNameError(templateName: string, addition: string | null, startsAt?: Date): string | null {
  if (!addition) return null;
  const length = startsAt ? [...instanceName(templateName, startsAt, addition)].length : [...titleBase(templateName, addition)].length + LONGEST_DATE;
  return length > RAID_NAME_MAX ? `The raid's full title must be ${RAID_NAME_MAX} characters or fewer. Shorten the title addition.` : null;
}

/**
 * A series' addition, cut so a generated raid's name still fits the thread name. Saving a
 * series checks the length, but its template can be renamed longer afterwards; tick must
 * still make the raid rather than fail or overflow.
 */
export function fitTitleAddition(templateName: string, addition: string | null): string | null {
  if (!addition || !raidNameError(templateName, addition)) return addition;
  const room = RAID_NAME_MAX - LONGEST_DATE - [...templateName].length - 2;
  const cut = [...addition].slice(0, Math.max(0, room)).join('').trim();
  return cut || null;
}
