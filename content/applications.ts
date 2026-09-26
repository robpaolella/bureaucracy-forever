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
  guildTime: 'Progression nights run',
  notes: 'Officer notes',
  notesPrivate: 'Only officers see this. Applicants never do.',
  noNotes: 'No notes yet.',
  composer: 'Add a note',
  noAccount: 'Applied without logging in: reach them by handle.',
  decided: (status: string, by: string | null) => (by ? `${status} by ${by}` : status),
};

/** docs/04 § Application detail § Actions: both confirmations name what the applicant will be told. */
export const ACTIONS = {
  accept: 'Accept',
  decline: 'Decline',
  toSocial: 'Move to social',
  acceptTitle: (name: string) => `Accept ${name}?`,
  acceptBody: 'They will be told they are in and invited to a short chat in Discord, then a two-week trial with full loot rights. Officer notes stay private.',
  acceptConfirm: 'Accept the application',
  declineTitle: (name: string) => `Decline ${name}?`,
  declineBody: 'They will be told the answer is no, plainly and without the reasons. Officer notes stay private.',
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
