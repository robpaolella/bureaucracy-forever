/**
 * About page copy. The accolades and history are the guild's real record. Officer names
 * are real founding members; only Konvett and Feraldog have cards for now.
 */
import type { WowClass } from '@/lib/design/class-colors';

export const ABOUT_HEAD = {
  eyebrow: 'About the guild',
  title: 'The story of Bureaucracy',
  paragraphs: [
    'Bureaucracy has been raiding together since 2011. Our best run in retail came in Warlords of Draenor, where we cleared Mythic Highmaul, Blackrock Foundry, and Hellfire Citadel.',
    "When WoW Classic launched, four of our founding members, Konvett, Celsian, Sylv, and Feraldog, came back together on Smolderweb with one goal: build the best raiding guild on the server. We started from behind. Other guilds had already cleared Molten Core, and we weren't even 60 yet.",
    "We put a strong group together, started doing speed clears, and set the fastest Molten Core time on the server. From that point on, Bureaucracy was the top raiding guild on Smolderweb. We took server firsts in Blackwing Lair and AQ40, held the server's fastest clear times, and finished as one of the top 100 guilds in the world to clear Naxxramas.",
    "What made it work was that everyone wanted the same thing: to be the best, and to do it alongside the best. That shared goal built one of the strongest raid teams on the server and a community that has stuck together ever since. Now we're taking it to WoW Forever.",
  ],
};

export const HOW_WE_RUN = {
  title: 'How we raid',
  points: [
    'We work out strats together as a guild.',
    'We review our logs after every raid to find where we can get better.',
    'Everyone shows up prepared, with consumables, enchants, and gear ready to go.',
    'Once content is on farm, we shift our focus to faster clear times.',
  ],
};

/** Real claims. Use as written. */
export const ACCOLADES = {
  eyebrow: 'Classic · Smolderweb',
  title: 'Our time in Classic',
  cards: [
    {
      eyebrow: 'Progression',
      title: 'Server firsts',
      text: 'First on Smolderweb to clear Blackwing Lair and AQ40.',
    },
    {
      eyebrow: 'Speed',
      title: 'Fastest clears',
      text: "Set the server's fastest clear times in Molten Core, Blackwing Lair, and AQ40.",
    },
    {
      eyebrow: 'Worldwide',
      title: 'Top 100 Naxxramas',
      text: 'One of the top 100 guilds in the world to clear Naxxramas.',
    },
  ],
};

export type HistoryEntry = { era: string; title: string; text: string; highlight?: boolean };

/** Era labels are words, not dates, except the real launch (docs/04 § About). */
export const HISTORY = {
  eyebrow: 'History',
  title: 'Guild history',
  entries: [
    {
      era: 'Classic launch · 2019',
      title: 'Back together on Smolderweb',
      text: 'Four founding members came back together for WoW Classic with the goal of building the best raiding guild on the server.',
    },
    {
      era: 'Molten Core',
      title: 'Fastest Molten Core on the server',
      text: "We started behind the other guilds on Smolderweb and finished with the server's fastest Molten Core clear.",
    },
    {
      era: 'Blackwing Lair',
      title: 'Server first Blackwing Lair',
      text: "First guild on Smolderweb to clear Blackwing Lair, along with the server's fastest clear time.",
    },
    {
      era: "Ahn'Qiraj",
      title: 'Server first AQ40',
      text: 'First guild on Smolderweb to clear AQ40, and the fastest clear time on the server again.',
    },
    {
      era: 'Naxxramas',
      title: 'Top 100 in the world',
      text: 'One of the top 100 guilds in the world to clear Naxxramas, and the #1 raiding guild on Smolderweb from Molten Core through Naxx.',
      highlight: true,
    },
    {
      era: 'November 4, 2026',
      title: 'WoW Forever',
      text: 'Bureaucracy heads to WoW Forever on US Alliance PvP with the same goal we had on Smolderweb.',
    },
  ] satisfies HistoryEntry[],
};

export type Officer = { name: string; wowClass: WowClass; title: string; guildMaster?: boolean };

export const OFFICERS: Officer[] = [
  { name: 'Konvett', wowClass: 'warlock', title: 'Guild Master', guildMaster: true },
  { name: 'Feraldog', wowClass: 'druid', title: 'Officer' },
];
