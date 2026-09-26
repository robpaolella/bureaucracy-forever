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
