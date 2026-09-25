/**
 * Home page copy. Voice: confident, plain, slightly dry. No exclamation marks.
 * Items marked PLACEHOLDER are invented (design-handover/CLAUDE.md § Content that is
 * placeholder) and must be replaced before launch. The pedigree claims are real.
 */

export const ANNOUNCEMENT = {
  eyebrow: 'Launch',
  text: 'WoW Forever goes live 4 November. We are recruiting now for the first lockout.',
  linkLabel: 'Open needs →',
  href: '/recruitment',
};

export const HERO = {
  eyebrow: 'Bureaucracy · WoW Forever',
  headline: ["We don't out-play people.", 'We out-prepare them.'],
  lede:
    'A competitive 40-player raiding guild carrying over from Classic — multiple server firsts and fastest clears on Smolderweb, top 500 worldwide through Naxxramas. Small enough that nobody here is a stranger.',
  primary: { label: 'Apply to raid', href: '/recruitment' },
  secondary: { label: 'See the raid week', href: '/schedule' },
};

/** The guild's three verified claims. Use as written. */
export const PEDIGREE = [
  { figure: 'Server firsts', text: 'Multiple first kills on Smolderweb in Classic, across the full raid tier list.' },
  { figure: 'Fastest clears', text: 'Server-best clear times, set with the same core the guild still raids with.' },
  { figure: 'Top 500 Naxx', text: 'Among the first 500 guilds worldwide to clear Naxxramas at release.' },
] as const;

export type TierState = 'cleared' | 'current' | 'locked';

export type ProgressionRow = {
  name: string;
  size: string;
  state: TierState;
  killed: number;
  total: number;
};

/** PLACEHOLDER kill counts. The real table reads from logs (docs/04 § Home). */
export const PROGRESSION: ProgressionRow[] = [
  { name: 'Molten Core', size: '40-player', state: 'cleared', killed: 10, total: 10 },
  { name: "Onyxia's Lair", size: '40-player', state: 'cleared', killed: 1, total: 1 },
  { name: 'Blackwing Lair', size: '40-player', state: 'current', killed: 6, total: 8 },
  { name: 'The Barrow Deeps', size: 'Not yet released', state: 'locked', killed: 0, total: 0 },
];

export const PROGRESSION_NOTE = 'Kill counts read from our logs on save — no one edits this table by hand.';

export const WEEK_NOTE =
  'Every time on this site is shown in server time with your own beside it. We detect your timezone — you never do the maths.';

export const CLOSING = {
  headline: "If you read the fight before you're asked to, you'll fit here.",
  text: "Applications take about ten minutes. An officer reads every one, and you'll hear back either way.",
  primary: { label: 'Apply to raid', href: '/recruitment' },
  secondary: { label: 'Apply as social', href: '/recruitment?path=social' },
};
