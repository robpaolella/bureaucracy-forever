/** Copy for the officer applications inbox and detail (docs/04, docs/03 § Empty states). */

export const INBOX_HEAD = {
  eyebrow: 'Officers',
  title: 'Applications',
  lede: 'Raider and social applications from the site. Notes here are private; applicants never see them.',
};

export const INBOX = {
  search: 'Search applications',
  paths: { raider: 'Raider', social: 'Social', all: 'All' },
  statuses: { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', all: 'All' },
  statusLabel: 'Status',
  summary: (shown: number, total: number) => `${shown} of ${total}`,
  noMatch: 'Nothing matches those filters.',
  unread: 'Unread',
  pickOne: 'Pick an application to read it.',
};

/** docs/03 § Empty states. */
export const INBOX_EMPTY = {
  title: 'Nothing pending',
  body: 'New applications land here and ping #officers.',
};

export const DETAIL = {
  back: 'All applications',
  submitted: 'Submitted',
  logs: 'Logs',
  noAnswers: 'The applicant left every question blank.',
  notes: 'Notes and messages',
  notesPrivate: 'Notes are for officers only. Rows marked DM went to or came from the applicant.',
  notesSynced: 'Synced with #applications',
  openThread: 'Open the thread',
  openWindow: 'Open on its own page',
  edited: 'edited',
  dmTo: (name: string) => `DM to ${name}`,
  dmFrom: (name: string) => `DM from ${name}`,
  deletedBy: (name: string) => `deleted by ${name}`,
  notDelivered: 'Not delivered',
  notSent: 'Not sent',
  attachments: (n: number) => `${n} attachment${n === 1 ? '' : 's'}, open it in Discord`,
  noNotes: 'No notes yet.',
  composer: 'Add a note',
  character: 'Character',
  noAccount: 'Applied without logging in: reach them by handle.',
  decided: (status: string, by: string | null) => (by ? `${status} by ${by}` : status),
};

/** docs/04 § Application detail § Actions: both confirmations name what the applicant will be told. */
export const ACTIONS = {
  accept: 'Accept',
  decline: 'Decline',
  toSocial: 'Move to social',
  acceptTitle: (name: string) => `Accept ${name}?`,
  acceptBody: 'They will be told they are in and invited to a short chat in Discord, then a two-week trial. Officer notes stay private.',
  acceptEffects: ['Status becomes Accepted and the Discord post is tagged Accepted.', 'The #applications thread is closed.', 'The applicant gets a DM with the trial details.', 'They get the Guild Member role and lose Guest.', 'They can be given a main on the roster, which puts them on future raids.'],
  acceptConfirm: 'Accept the application',
  declineTitle: (name: string) => `Decline ${name}?`,
  declineBody: 'They will be told the answer is no, plainly and without the reasons. Officer notes stay private.',
  declineEffects: ['Status becomes Declined and the Discord post is tagged Declined.', 'The #applications thread is closed.', 'The applicant gets a short DM.', 'No role changes. Reopen is available if this was a mistake.'],
  declineConfirm: 'Decline the application',
  keep: 'Not yet',
  accepted: (name: string) => `Accepted ${name}`,
  declined: (name: string) => `Declined ${name}`,
  movedToSocial: (name: string) => `${name} moved to the social path`,
  dmNote: 'The Discord message goes out with the bot sync.',
};

export const NOTE_COMPOSER = {
  label: 'Add a note',
  placeholder: 'Only officers will read this.',
  post: 'Post',
  posted: 'Note added',
};

/**
 * The Interview card on an application (design/341-interview-scheduling, card A). `{who}`
 * is an officer's name, `{when}` a time, `{day}` a date, `{end}` the window's end; `fill`
 * puts them in as rich pieces.
 */
export const INTERVIEW = {
  title: 'Interview',
  openThread: 'Open the thread',
  actionsNote: 'Book, propose and cancel in the Discord thread.',
  anOfficer: 'an officer',
  words: { AWAITING_TIMES: 'Waiting for times', TIMES_RECEIVED: 'Times received', PROPOSED: 'Proposed', BOOKED: 'Booked', DONE: 'Done', CANCELLED: 'Cancelled', NO_TIME: 'No time found', CLOSED: 'Closed' },
  halfHours: (n: number) => `${n} half-hour${n === 1 ? '' : 's'}`,
  awaiting: (name: string) => `Requested by {who} on {when}. ${name} hasn’t sent times yet. If none arrive by {end}, it ends with no time found.`,
  second: (name: string) => `Second interview, requested by {who} on {when}. ${name} hasn’t sent times yet.`,
  received: (name: string, count: string, who: string) => `${name} sent ${count}, last changed on {when}. Requested by ${who}.`,
  proposed: (name: string) => `{who} proposed {when}. Waiting for ${name} to accept or decline.`,
  booked: () => 'Booked for {when} by {who}.',
  done: (who: string) => `Interviewed on {when}. Booked by ${who}.`,
  declined: (name: string, who: string) => `${name} declined ${who}’s proposed time, {when}. Officers arrange a time with them directly.`,
  lapsed: (name: string, who: string) => `${name} didn’t answer ${who}’s proposed time, {when}, before it started. Officers arrange a time with them directly.`,
  expired: (name: string) => `${name} didn’t send times by {end}. Officers arrange a time with them directly.`,
  cancelled: () => 'Cancelled by {who} on {day}.',
  cancelledUnknown: () => 'Cancelled on {day}.',
  wasBooked: ' It had been booked for {when}.',
  closed: (name: string, sent: string | null) => `Closed when the application was decided. ${sent ? `${name} had sent ${sent}.` : `${name} hadn’t sent any times.`}`,
  earlier: (outcome: string) => `Earlier interview: ${outcome}, {day}.`,
};
