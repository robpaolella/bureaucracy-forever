/**
 * The applicant's interview page (/apply/interview). Wording from the approved design,
 * design/341-interview-scheduling (revision 1, version F).
 */
export const INTERVIEW = {
  eyebrow: 'Interview',
  pageTitle: 'Interview',
  description: 'Your interview with the Bureaucracy officers.',
  loading: 'Loading…',
  signedOut: {
    title: 'Sign in to share your times',
    body: 'Sign in with the Discord account you applied with, and we’ll bring you back here.',
    action: 'Sign in with Discord',
  },
  nothing: {
    title: 'Nothing to schedule',
    body: 'There’s no interview waiting for this Discord account. If an officer asked you to pick times, check you’re signed in with the account you applied with.',
    action: 'Back to the home page',
  },
  // Until the time picker lands: the picker's own heading and lede.
  pick: {
    title: 'Officer interview',
    body: 'Mark your availability for a 15–20 minute interview with an officer. Choose all times that you’re available to make scheduling easier.',
  },
  submitted: {
    title: 'Your times are with the officers',
    body: 'We’ll let you know on Discord when your interview is booked. You can change your times until then.',
    timesLabel: (hours: number) => `Your times · ${hours} ${hours === 1 ? 'hour' : 'hours'}`,
  },
  proposed: {
    title: 'Could you do this time instead?',
    body: 'The officers couldn’t make any of your times.',
  },
  booked: {
    title: 'Your interview is booked',
    body: 'At that time, please join the Public Lounge voice channel in our Discord and an officer will bring you in.',
    action: 'Open Discord',
  },
  cancelled: {
    title: 'Your interview was cancelled',
    before: 'Your interview on',
    after: 'has been cancelled. An officer will be in touch.',
    // Cancelled before anything was booked (Robert, 2026-10-16).
    noTime: 'Your interview has been cancelled. An officer will be in touch.',
  },
  noTime: {
    title: 'We couldn’t find a time',
    body: 'An officer will reach out to you directly to arrange one.',
  },
  closed: {
    title: 'This interview is closed',
    body: 'This interview is closed because your application has been decided. An officer will be in touch on Discord.',
  },
  done: {
    title: 'Thanks for talking with us',
    body: 'We’ll get back to you on Discord within a few days.',
  },
} as const;
