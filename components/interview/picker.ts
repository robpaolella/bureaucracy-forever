import { INTERVIEW } from '@/content/interview';
import { countBlocks, MIN_BLOCKS, MIN_DAYS } from '@/lib/interview-minimum';
import { formatUtcOffset, tzOffsetMs, zonedParts, zoneAbbreviation } from '@/lib/time';

const HALF_HOUR = 30 * 60_000;
const HOUR = 60 * 60_000;

/** One calendar day in the picker's zone, with the starts offered on it (epoch ms, in order). */
export type PickerDay = { key: number; year: number; month: number; day: number; starts: number[] };

/** Group `starts` (ascending) by calendar day in `zone`. */
export function pickerDays(starts: number[], zone: string): PickerDay[] {
  const days: PickerDay[] = [];
  for (const t of starts) {
    const p = zonedParts(new Date(t), zone);
    const key = p.year * 10_000 + p.month * 100 + p.day;
    const last = days.at(-1);
    if (last?.key === key) last.starts.push(t);
    else days.push({ key, year: p.year, month: p.month, day: p.day, starts: [t] });
  }
  return days;
}

/**
 * The day's starts as one-hour buttons on the viewer's clock, in order. A button holds both of
 * its half-hour starts, or one at a window edge. A zone on a half-hour offset still reads whole
 * hours, so a button there can span two guild hours.
 */
export function hourButtons(starts: number[], zone: string): number[][] {
  const hours: { bucket: number; starts: number[] }[] = [];
  for (const t of starts) {
    // The wall clock's hour, from the real instant so a repeated hour at a DST change stays two buttons.
    const sub = ((tzOffsetMs(new Date(t), zone) % HOUR) + HOUR) % HOUR;
    const bucket = Math.floor((t + sub) / HOUR);
    const last = hours.at(-1);
    if (last?.bucket === bucket) last.starts.push(t);
    else hours.push({ bucket, starts: [t] });
  }
  return hours.map((h) => h.starts);
}

/** Split buttons into runs of consecutive hours, so a gap (the viewer's midnight) shows as a break. */
export function hourRuns(hours: number[][]): number[][][] {
  const runs: number[][][] = [];
  for (const hour of hours) {
    const run = runs.at(-1);
    const previous = run?.at(-1)?.at(-1);
    if (run && previous !== undefined && hour[0] - previous <= HALF_HOUR) run.push(hour);
    else runs.push([hour]);
  }
  return runs;
}

export type PickerSummary = { text: string; tone: 'closed' | 'warn'; canSend: boolean };

/** The footer's status line and whether Send is open. Counts with `countBlocks`, as the server does. */
export function pickerSummary(picks: Iterable<number>): PickerSummary {
  const { blocks, days } = countBlocks([...picks].map((t) => new Date(t)));
  const { footer } = INTERVIEW.pick;
  if (blocks === 0) return { text: footer.empty(MIN_BLOCKS, MIN_DAYS), tone: 'closed', canSend: false };
  if (blocks < MIN_BLOCKS) return { text: footer.needMore(blocks, MIN_BLOCKS, MIN_BLOCKS - blocks, days < MIN_DAYS), tone: 'warn', canSend: false };
  if (days < MIN_DAYS) return { text: footer.needDay(blocks), tone: 'warn', canSend: false };
  return { text: footer.ready(blocks, days), tone: 'warn', canSend: true };
}

/** "Eastern time · EDT (UTC−4)": the zone's own name, its short name and its offset at `at`. */
export function zoneLabel(zone: string, at: Date): string {
  let name = zone.replace(/_/g, ' ');
  try {
    const generic = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longGeneric' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
    if (generic) name = generic.replace(/ Time$/, ' time');
  } catch {
    // Keep the zone's id where Intl has no generic name.
  }
  return `${name} · ${zoneAbbreviation(at, zone)} (${formatUtcOffset(at, zone)})`;
}
