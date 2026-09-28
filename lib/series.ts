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

/** "Molten Core — Thu Oct 15", the post title and the raid name for a generated instance. */
export function instanceName(templateName: string, startsAt: Date, zone: string = GUILD_TIMEZONE): string {
  const p = zonedParts(startsAt, zone);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.weekday];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.month - 1];
  return `${templateName} — ${day} ${month} ${p.day}`;
}
