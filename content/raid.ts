/** Copy for the raid detail page (docs/04 § Raid detail). */

export const RAID_EYEBROW = 'Raid';
export const BACK_TO_CALENDAR = 'Back to the calendar';

export const SUMMARY = {
  heading: 'Sign-ups',
  acceptedOf: 'accepted of',
  needed: 'needed',
  notes: 'Notes',
  noNotes: 'No notes for this raid yet.',
  cancelled: 'This raid was cancelled.',
};

export const SECTIONS = {
  accept: 'Accepted',
  tentative: 'Tentative',
  absent: 'Absent',
} as const;

export const SECTION_EMPTY = {
  accept: 'Nobody has accepted yet.',
  tentative: 'Nobody is tentative.',
  absent: 'Nobody has declined.',
} as const;

export const SET_BY = 'set by';
export const UNKNOWN_MAIN = 'No main on the roster';

export const OFFICER_ACTIONS = {
  heading: 'Officer actions',
  edit: 'Edit raid',
  post: 'Post to Discord',
  cancel: 'Cancel raid',
  pending: 'Arrives with the schedule form.',
  postPending: 'Arrives with the Discord sync.',
  onBehalf: 'Answer for a member',
  member: 'Member',
  response: 'Response',
  clear: 'Clear their answer',
  apply: 'Set',
  choose: 'Choose a member…',
};

export function onBehalfToast(name: string, response: string | null): string {
  return response ? `${name} marked ${response}` : `${name}'s answer cleared`;
}
