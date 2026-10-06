/** Copy for the member availability page (docs/05 § Member view). */

export const AVAILABILITY_HEAD = {
  eyebrow: 'Members',
  title: 'When can you raid?',
  lede: 'Click and drag to paint the half-hours you can make. Officers see the whole roster stacked on one grid — this is how the schedule gets set.',
};

/** Above the desktop grid, in the phone hint's style (design/158-availability-blocks). */
export const AVAILABILITY_DESKTOP_HINT = 'Drag to paint a run of half-hours. Click a block to resize or remove it.';

/** Above the phone day column (design/158-availability-blocks). */
export const AVAILABILITY_PHONE_HINT =
  'Tap a half-hour to paint it, or tap a block to resize or remove it. Hold, then drag, to paint a run. Swipe sideways for another day.';

export const AVAILABILITY_LEGEND_NOTE = 'Bronze rows on the left mark the top of each hour. Only officers see who painted what.';

/** Copy for the officer heatmap (docs/05 § Officer view; artboard Availability-Officer.html). */
export const OFFICER_AVAILABILITY_HEAD = {
  eyebrow: 'Officers',
  title: 'Roster availability',
  lede: "Every member's painted week, stacked. Hover a half-hour to see who is free and what the roles look like.",
};

export const WINDOW_FINDER = {
  title: 'Find raid windows',
  lede: 'Set what a raid needs. We rank every start time that holds those numbers for the whole run.',
  /** docs/03 § Empty states: inline in the panel, never an empty list. */
  none: 'Nothing in the week holds those numbers for the full length. Lower a minimum or shorten the raid.',
};

/** docs/03 § Empty states: the grid stays, at heat-0, with this centred over it. */
export const NOBODY_SUBMITTED = 'Nobody has painted a week yet. The grid fills in as members save theirs.';

export const NUDGE_LABEL = 'Nudge the rest in Discord';
export const NUDGE_SENT = (n: number) => (n === 1 ? 'Nudged one member in Discord' : `Nudged ${n} members in Discord`);
export const NUDGE_NONE = 'Everyone has painted a week; nobody to nudge.';
export const NUDGE_FAILED = "Couldn't reach the bot — try again in a minute.";
export const NUDGE_UNCONFIGURED = 'Discord sync is not configured yet.';
