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
export const SCHEDULE_RAID_PENDING = 'Arrives with the raid detail page.';
export const SAVE_FAILED = "Couldn't save that — try again.";
