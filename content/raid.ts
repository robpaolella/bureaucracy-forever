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
  cancelReason: 'Reason:',
  locksAt: 'Sign-ups lock',
  locked: 'Sign-ups are locked',
  done: 'Finished',
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
  openThread: 'Open in Discord',
  notPosted: 'Not posted to Discord yet',
  notPostedHint: 'The bot posts each raid to #raid-signups on the series schedule.',
  cancel: 'Cancel raid',
  restore: 'Restore raid',
  cancelTitle: 'Cancel this raid?',
  cancelBody: 'Sign-ups stay on record and the raid stays on the calendar, marked cancelled. Everyone who accepted is told in Discord. You can restore it later.',
  cancelReason: 'Reason',
  cancelReasonHint: 'Shown on the Discord post and in the messages to those who accepted.',
  cancelReasonPlaceholder: 'Not enough healers this week',
  cancelConfirm: 'Cancel the raid',
  keep: 'Keep it',
  delete: 'Delete raid',
  deleteTitle: 'Delete this raid?',
  deleteBody:
    'The raid, every sign-up and any attendance recorded for it are removed for good. Nobody is told: the Discord post and its thread simply disappear. If people should hear about it, cancel the raid instead. This cannot be undone.',
  deleteSeries: 'It came from a weekly series: this week is skipped and the series carries on.',
  deleteConfirm: 'Delete the raid',
  finished: 'This raid has finished.',
  restoreFirst: 'Restore the raid to edit it.',
  onBehalf: 'Answer for someone not listed',
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

/** The roster grouped by role (SYNC-SPEC §9.5). */
export const ROSTER = {
  heading: 'Roster',
  empty: 'Nobody is on this roster yet. The roster comes from rank: raiders, trials and officers.',
  noRole: 'No main set',
  member: 'Member',
  updated: 'Updated',
  answer: 'Answer',
  via: 'Via',
  noAnswer: 'No answer yet',
  answerFor: 'Answer for them',
  attended: 'Attended',
  missed: 'Did not attend',
  reasonPrefix: 'Reason:',
};

export const ANSWER_LABEL = { accept: 'Accepted', tentative: 'Tentative', absent: 'Absent' } as const;

export const BENCH = {
  heading: 'Bench',
  lede: 'Members off the roster who answered. Bench answers do not fill a slot until an officer moves them.',
  empty: 'Nobody on the bench.',
  moveToRoster: 'Move to roster',
  moved: (name: string) => `${name} moved to the roster`,
};

export const UNANSWERED = {
  heading: "Hasn't answered",
  empty: 'Everyone on the roster has answered.',
  nudge: 'Nudge in Discord',
  nudgeHint: 'Mentions them in the raid thread.',
  nudged: (n: number) => (n === 1 ? 'Nudged 1 member in Discord' : `Nudged ${n} members in Discord`),
  noThread: 'The raid is not posted to Discord yet.',
};

export const ATTENDANCE = {
  heading: 'Mark attendance',
  lede: 'Tick everyone who showed up. Accepted members are ticked to start with; tentative ones are not.',
  empty: 'Nobody accepted or was tentative, so there is nobody to mark.',
  bench: 'bench',
  save: 'Save attendance',
  saved: (n: number) => (n === 1 ? 'Attendance saved for 1 member' : `Attendance saved for ${n} members`),
};

export const RESPONSE_NOTES = {
  bringing: 'Bringing',
  characterChanged: 'Character changed',
  locked: 'Sign-ups are locked. Ask an officer if something changed.',
  offRoster: "You're not on this roster. Accepting puts you on the bench.",
  youAnswered: 'You answered',
};
