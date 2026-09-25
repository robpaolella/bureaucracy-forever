/**
 * Raid week. PLACEHOLDER — design-handover/CLAUDE.md lists raid nights and times among
 * the invented content. Confirm with the guild before launch.
 *
 * Times are realm wall-clock ("HH:MM", 24h) in REALM_TIMEZONE (lib/config.ts). Never
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
