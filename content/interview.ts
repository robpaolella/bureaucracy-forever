/**
 * The applicant's interview page (/apply/interview). Wording from the approved designs:
 * design/367-interview-picker (revision 2, version G) for the time picker, design/341-interview-scheduling
 * (revision 1) for the rest.
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
  pick: {
    title: 'Officer interview',
    body: 'Mark your availability for a 15–20 minute interview with an officer. Choose all times that you’re available to make scheduling easier.',
    detecting: 'Detecting…',
    noTimes: 'There are no times left to pick. An officer will reach out to you directly to arrange one.',
    length: '15–20 minutes',
    where: 'Discord voice · Public Lounge',
    startTimes: 'Start times',
    signedInAs: (name: string) => `Signed in as ${name}`,
    zoneButton: (zone: string) => `Time zone: ${zone}. Change it`,
    month: { previous: 'Previous month', next: 'Next month', legend: 'Days you’ve picked times on', days: 'Days with interview times' },
    switchLabel: 'Show times in',
    yourTime: 'Your time',
    guildTime: 'Guild time',
    hoursIn: (zone: string) => `Hours in ${zone}`,
    pickedOnDay: (n: number) => `${n} picked`,
    note: 'Pick every hour you’re available. The more you pick, the easier it is to schedule.',
    pickAll: 'Pick all',
    clearDay: 'Clear this day',
    clearAll: 'Clear all',
    send: 'Send my times',
    dayLabel: (day: string, picked: number) => (picked ? `${day}, ${picked} picked` : day),
    hourLabel: (yours: string, guild: string, inGuildTime: boolean) => (inGuildTime ? `Could start any time ${guild}, ${yours} your time` : `Could start any time ${yours}, ${guild}`),
    guildOnlyHourLabel: (guild: string) => `Could start any time ${guild}`,
    confirm: {
      title: 'Clear all your times?',
      body: 'This removes every hour you’ve picked, on every day.',
      keep: 'Keep them',
      clear: 'Clear all',
    },
    footer: {
      empty: (blocks: number, days: number) => `Nothing picked yet · pick at least ${blocks} hours on ${days} or more days`,
      needMore: (picked: number, blocks: number, more: number, otherDay: boolean) => `${picked} of ${blocks} hours picked · add ${more} more${otherDay ? ', on another day' : ''}`,
      needDay: (picked: number) => `${picked} hours picked on 1 day · add an hour on another day`,
      ready: (hours: number, days: number) => `${hours} hours picked on ${days} days · not sent yet`,
    },
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
