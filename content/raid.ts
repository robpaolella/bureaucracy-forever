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
  editTitle: 'Edit raid',
  save: 'Save changes',
  post: 'Post to Discord',
  cancel: 'Cancel raid',
  restore: 'Restore raid',
  cancelTitle: 'Cancel this raid?',
  cancelBody: 'Sign-ups stay on record and the raid stays on the calendar, marked cancelled. You can restore it later.',
  cancelConfirm: 'Cancel the raid',
  keep: 'Keep it',
  postPending: 'Arrives with the Discord sync.',
  finished: 'This raid has finished.',
  restoreFirst: 'Restore the raid to edit it.',
  onBehalf: 'Answer for a member',
  member: 'Member',
  response: 'Response',
  clear: 'Clear their answer',
  apply: 'Set',
  choose: 'Choose a member…',
};

export const RAID_TOASTS = {
  edited: (name: string) => `Saved ${name}`,
  cancelled: (name: string) => `Cancelled ${name}`,
  restored: (name: string) => `Restored ${name}`,
};

export function onBehalfToast(name: string, response: string | null): string {
  return response ? `${name} marked ${response}` : `${name}'s answer cleared`;
}
