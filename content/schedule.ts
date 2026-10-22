/**
 * Raid week. PLACEHOLDER — design-handover/CLAUDE.md lists raid nights and times among
 * the invented content. Confirm with the guild before launch.
 *
 * Times are guild wall-clock ("HH:MM", 24h) in GUILD_TIMEZONE (lib/config.ts). Never
 * store or show a bare time: components turn each into its next instant and render it with
 * LocalTime, in the viewer's zone with guild time on hover, tap and focus.
 */
import { minutesBetween, nextOccurrence, type Weekday } from '@/lib/time';

export type RaidNight = {
  day: Weekday;
  start: string;
  end: string;
  kind: string;
  optional: boolean;
};

export const RAID_NIGHTS: RaidNight[] = [
  { day: 2, start: '20:00', end: '23:00', kind: 'Progression', optional: false },
  { day: 4, start: '20:00', end: '23:00', kind: 'Progression', optional: false },
  { day: 0, start: '19:00', end: '22:00', kind: 'Clear night', optional: true },
];

/** `weekday`, `start` and `end` are guild time; the optional night has none until it is set. */
export type RaidWeekSlot = { day: string; kind: string; optional: boolean; weekday?: Weekday; start?: string; end?: string };

/** Tuesday and Thursday set by Robert on 2026-10-22, "for now"; the optional night is undecided. */
export const RAID_WEEK: RaidWeekSlot[] = [
  { day: 'Tuesday', kind: 'Progression', optional: false, weekday: 2, start: '20:00', end: '23:00' },
  { day: 'Thursday', kind: 'Progression', optional: false, weekday: 4, start: '20:00', end: '23:00' },
  { day: 'Optional Day', kind: 'Farm/Alt Runs', optional: true },
];

/** The slot's next occurrence for `LocalTime`, or null while it has no time. Computed on the server, so pages using it must revalidate. */
export function slotTime(slot: RaidWeekSlot, from: Date = new Date()): { startsAt: string; durationMin: number } | null {
  if (slot.weekday === undefined || !slot.start || !slot.end) return null;
  return { startsAt: nextOccurrence(slot.weekday, slot.start, undefined, from).toISOString(), durationMin: minutesBetween(slot.start, slot.end) };
}

/** Week strip order: Monday first, as drawn in Schedule.html. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Weekly lockout reset, guild time. */
export const LOCKOUT_RESET = { day: 2 as Weekday, time: '08:00' };

export const SCHEDULE_HEAD = {
  eyebrow: 'Raid schedule',
  title: 'Two progression nights, plus one optional night.',
  lede: "Raid times show in your own time zone, so you'll always know when raid starts where you are. Our optional night is still to be set.",
};

export const WEEK_NOTE_PREFIX = 'Raid nights are shown in bronze. Lockouts reset';

/** The run of a progression night, anchored to the first raid night of the week. */
export const RUN_OF_NIGHT = {
  title: 'How a night runs',
  anchorDay: 2 as Weekday,
  rows: [
    { time: '19:50', text: 'Invites go out. Be summoned, buffed and repaired.' },
    { time: '20:00', text: 'First pull. Not "first explanation".' },
    { time: '21:25', text: 'Five-minute break. Restock, then back in voice.' },
    { time: '23:00', text: 'Out, whatever the boss is at. We come back Thursday.' },
  ],
};

/** The bottom card's rows (approved design 254): static text, same for every visitor. */
export const SCHEDULE_ASIDES = [
  { title: 'Attendance', text: "Raiders attend both progression nights. If you can't make one, let us know in Discord ahead of time." },
  { title: 'Sign-ups', text: 'Sign up for each raid as Accept, Tentative or Absent, on the calendar or with our bot in Discord.' },
  { title: 'Loot', text: 'Loot runs on hard reserve, then soft reserve, then open roll.' },
];
