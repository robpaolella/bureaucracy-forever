/** Copy for the raid calendar (docs/04 § Raid calendar, docs/03 § Empty states, § Session states). */

export const CALENDAR_HEAD = {
  eyebrow: 'Members',
  title: 'Raid calendar',
  lede: 'Every scheduled raid with who is coming. Answer here or in Discord; both land in the same place.',
};

export const CALENDAR_EMPTY = {
  title: 'Nothing on the calendar yet',
  body: 'Officers schedule raids from Discord or here. The next one will show up the moment it is posted.',
};

export const CALENDAR_PAST_EMPTY = 'No raids have happened yet.';

/** docs/03 § Session states, 4: a one-line prompt above the list, never a block. */
export const AVAILABILITY_PROMPT = 'You have not painted your availability yet. Officers use it to pick raid nights.';

export const SCHEDULE_RAID = 'Schedule a raid';

/** The schedule form (docs/04 § Raid calendar head; docs/03 § Officer nav "Schedule a raid"). */
export const SCHEDULE_FORM = {
  title: 'Schedule a raid',
  name: 'Raid',
  namePlaceholder: 'Blackwing Lair',
  date: 'Date',
  time: 'Start',
  guildHint: 'Guild time. Members see it in their own zone too.',
  duration: 'Length',
  requirements: 'Needed',
  notes: 'Notes',
  notesHint: 'Optional. Shown on the raid page.',
  submit: 'Schedule',
  cancel: 'Cancel',
  preview: 'Members will see',
};

export function scheduledToast(name: string, weekday: string): string {
  return `Scheduled ${weekday} — ${name}`;
}

/** Heatmap window rows link here so a window becomes a raid in one step. */
export const SCHEDULE_FROM_WINDOW = 'Schedule';
export const SAVE_FAILED = "Couldn't save that — try again.";

/** The month grid and the List / Month toggle (SYNC-SPEC §9.4). */
export const MONTH = {
  view: 'View',
  list: 'List',
  month: 'Month',
  previous: 'Previous month',
  next: 'Next month',
  today: 'Today',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  answered: 'you answered',
  cancelled: 'cancelled',
  yours: 'yours',
  guild: 'guild',
};
