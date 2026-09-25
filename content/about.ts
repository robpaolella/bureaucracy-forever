/**
 * About page copy. The three accolades are the guild's real claims. Officer names and
 * the history entries are PLACEHOLDER (design-handover/CLAUDE.md) except the real
 * 4 November 2026 launch.
 */
import type { WowClass } from '@/lib/design/class-colors';

export const ABOUT_HEAD = {
  eyebrow: 'About the guild',
  title: 'A small guild with a long memory',
  paragraphs: [
    "Bureaucracy started on Smolderweb in Classic with a simple bargain: everybody reads the fight, everybody brings their own consumables, and nobody has to be carried. That bargain took us to multiple server firsts, the server's fastest clear times, and into the top 500 guilds worldwide to clear Naxxramas at release.",
    "We are not a large guild and we don't want to be. Forty people who know each other's pulls is worth more than a bench of two hundred. The roster turns over slowly, officers have been in the same seats for years, and most nights end with people still in voice long after the last boss.",
    'WoW Forever is a fresh start on ground we know. Same standards, same three nights, same people — and room for a handful more.',
  ],
};

export const HOW_WE_RUN = {
  title: 'How we run a night',
  points: [
    'Invites ten minutes before the hour. First pull on the hour.',
    'Strategy is posted in Discord before the night, not explained at the summoning stone.',
    'One officer calls. Everyone else listens, then talks between pulls.',
    'We stop on time. Nobody is asked to choose between a kill and their morning.',
  ],
};

/** Real claims. Use as written. */
export const ACCOLADES = {
  eyebrow: 'Classic · Smolderweb',
  title: 'What we did last time',
  cards: [
    {
      eyebrow: 'Server first',
      title: 'Multiple first kills',
      text: "Across the tier list on Smolderweb — the kind that get announced in trade chat before you've finished looting.",
    },
    {
      eyebrow: 'Speed',
      title: 'Fastest clear times',
      text: 'Server-best clears, set by preparation rather than by raiding more nights than anyone else.',
    },
    {
      eyebrow: 'Worldwide',
      title: 'Top 500 Naxxramas',
      text: 'Among the first 500 guilds on any realm to clear Naxxramas at release.',
    },
  ],
};

export type HistoryEntry = { era: string; title: string; text: string; highlight?: boolean };

/** Era labels are words, not dates, except the real launch (docs/04 § About). */
export const HISTORY = {
  eyebrow: 'History',
  title: 'The short version',
  note: 'Add a line here each time something happens. The component takes an era label, a title and a paragraph.',
  entries: [
    {
      era: 'Classic launch',
      title: 'Formed on Smolderweb',
      text: "A core of people who had raided together before, plus a rule that nobody joins a pull they haven't read about.",
    },
    {
      era: 'Molten Core & Onyxia',
      title: 'First server-first kills',
      text: 'Forty people on time, three nights a week, turned into the first of the server firsts that followed.',
    },
    {
      era: 'Blackwing Lair & AQ40',
      title: 'Fastest clears on the realm',
      text: 'Clear nights stopped being progression and started being a time trial.',
    },
    {
      era: 'Naxxramas',
      title: 'Top 500 worldwide at release',
      text: 'The high-water mark of Classic for us, and the standard every night since has been measured against.',
      highlight: true,
    },
    {
      era: '4 November 2026',
      title: 'WoW Forever',
      text: 'Same guild, fresh realm, new zones to read about before anyone else does.',
    },
  ] satisfies HistoryEntry[],
};

export type Officer = { name: string; wowClass: WowClass; title: string; guildMaster?: boolean; blurb: string };

/** PLACEHOLDER names. An officer card is a roster row with a sentence attached. */
export const OFFICERS: Officer[] = [
  { name: 'Ledgerline', wowClass: 'warrior', title: 'Guild Master', guildMaster: true, blurb: 'Raid lead and final word on loot.' },
  { name: 'Redtape', wowClass: 'priest', title: 'Healing officer', blurb: 'Assignments, cooldowns, and the healer roster.' },
  { name: 'Subclause', wowClass: 'warlock', title: 'Recruitment', blurb: 'Reads every application and answers it.' },
];
