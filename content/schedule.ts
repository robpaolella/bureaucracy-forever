/**
 * Raid week. PLACEHOLDER — design-handover/CLAUDE.md lists raid nights and times among
 * the invented content. Confirm with the guild before launch.
 *
 * Times are guild wall-clock ("HH:MM", 24h) in GUILD_TIMEZONE (lib/config.ts). Never
 * store or show a bare time: components render these beside the viewer's local time.
 */
import type { Weekday } from '@/lib/time';

export type RaidNight = {
  day: Weekday;
  start: string;
  end: string;
  kind: string;
  optional: boolean;
};

export const RAID_NIGHTS: RaidNight[] = [
  { day: 2, start: '20:00', end: '23:00', kind: 'Progression', optional: false },
  { day: 3, start: '20:00', end: '23:00', kind: 'Progression', optional: false },
  { day: 0, start: '19:00', end: '22:00', kind: 'Clear night', optional: true },
];

export type RaidWeekSlot = { day: string; kind: string; optional: boolean };

/** Pre-launch: raid days and times aren't set, so the public pages name slots, not weekdays. */
export const RAID_WEEK: RaidWeekSlot[] = [
  { day: 'Day 1', kind: 'Progression', optional: false },
  { day: 'Day 2', kind: 'Progression', optional: false },
  { day: 'Optional Day', kind: 'Farm/Alt Runs', optional: true },
];

/** Week strip order: Monday first, as drawn in Schedule.html. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Weekly lockout reset, guild time. */
export const LOCKOUT_RESET = { day: 2 as Weekday, time: '08:00' };

export const SCHEDULE_HEAD = {
  eyebrow: 'Raid schedule',
  title: 'Two progression nights. Days to be announced.',
  lede: 'Raid days and times get set before launch, around when the roster can actually play. When they land, every time on this page is written twice: guild time, and the time on your own clock.',
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
    { time: '23:00', text: 'Out, whatever the boss is at. We come back Wednesday.' },
  ],
};

export const SCHEDULE_ASIDES = {
  attendance: {
    title: 'Attendance',
    text: "Raiders are expected on both progression nights. Miss one, post in Discord before the day — that's the whole rule.",
  },
  signups: {
    title: 'Sign-ups',
    text: 'Accept, Tentative or Absent — on the calendar here or with the bot in Discord. Both write to the same place.',
    linkLabel: 'Open the calendar →',
  },
  availability: {
    title: 'Help us pick the days',
    text: 'Paint your week on the availability page after you log in. Officers set raid days around what the roster actually has.',
  },
};
