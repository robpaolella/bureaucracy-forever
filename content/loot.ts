/**
 * Loot rules. PLACEHOLDER policy: design-handover/CLAUDE.md says this was written as a
 * loot council and is marked "[confirm this is still your system]". Replace before launch.
 */

export const LOOT_HEAD = {
  eyebrow: 'Policy',
  title: 'Loot rules',
  lede: 'Loot exists to make the next boss die faster. Everything below follows from that one sentence, and an officer will say it out loud if a call ever looks strange.',
};

export type LootSection = { id: string; tocLabel: string };

/** Table of contents, in page order. */
export const LOOT_TOC: LootSection[] = [
  { id: 'summary', tocLabel: 'In short' },
  { id: 'who', tocLabel: 'Who decides' },
  { id: 'weigh', tocLabel: 'How we weigh a drop' },
  { id: 'trials', tocLabel: 'Trials and off-spec' },
  { id: 'faq', tocLabel: 'Questions we get' },
];

export const LOOT_SUMMARY = {
  title: 'In short',
  bullets: [
    { lead: 'Loot council', flag: '[confirm this is still your system]', text: '— three officers, decided in under a minute, announced with a reason.' },
    { lead: 'Biggest raid gain wins', text: ', not longest wait and not highest attendance.' },
    { lead: 'Trials receive loot from night one', text: '— on the same terms as everyone else.' },
    { lead: 'Nothing is owed to anyone.', text: ' There is no points balance to spend and nothing to hoard.' },
  ],
};

export const LOOT_WHO = {
  title: 'Who decides',
  paragraphs: [
    'Three officers sit on council for a tier: the raid lead, the healing officer and one rotating raider seat. The rotating seat changes each tier and is announced in Discord — it exists so the council is never only officers.',
    'Calls are made between pulls, not during them. If a decision needs more than a minute, the item is held and awarded at the break with the reasoning posted.',
  ],
};

export const LOOT_WEIGH = {
  title: 'How we weigh a drop',
  intro: 'In this order, and out loud when it is close:',
  factors: [
    { title: 'Raid-wide gain', text: "A tank's survivability and a healer's mana beat a DPS upgrade of the same size." },
    { title: 'Size of the upgrade', text: 'Measured against what you are actually wearing, not against your best-in-slot list.' },
    { title: 'Attendance and preparation', text: 'The tiebreaker, not the rule. Showing up buys you the coin flip, not the item.' },
    { title: 'Recent loot', text: 'If two cases are genuinely level, the person who received less this tier takes it.' },
  ],
};

export const LOOT_TRIALS = {
  title: 'Trials and off-spec',
  paragraphs: [
    'Trials compete for loot on equal terms from their first night. A guild that makes trials wait is a guild that benches them the moment it matters, and we would rather find out early whether someone is worth gearing.',
    "Off-spec pieces go after every main-spec need is met. An off-spec set the raid genuinely relies on — an off-tank's threat gear, a healer's damage set for a specific fight — is treated as main spec for that fight, and the council says so before the boss, not after the drop.",
  ],
};

export const LOOT_FAQ = {
  title: 'Questions we get',
  items: [
    {
      q: 'Can I reserve an item before the raid?',
      a: 'No. You can tell the council an item matters to you and why, in the raid channel, before the pull — that is heard and weighed. Nothing is held for anyone.',
    },
    {
      q: 'What happens to bind-on-equip drops and patterns?',
      a: 'They go to the guild bank and fund repairs, world-buff logistics and the consumables the guild does supply. Patterns go to a crafter who agrees to craft for the guild at cost.',
    },
    {
      q: 'I disagree with a call. What now?',
      a: 'Say so after the raid, in a DM to any officer or in #loot. Not mid-pull, and not in raid chat. Calls are occasionally reversed; saying it the right way is what makes that possible.',
    },
    {
      q: 'Does missing raids cost me loot?',
      a: 'Not directly — there is no balance to lose. Attendance is a tiebreaker, so over a tier it shows up. Tell us in advance and it counts for far more than you would expect.',
    },
    {
      q: 'Do officers get priority?',
      a: 'No, and an officer on council steps out of the discussion for an item they are in the running for.',
    },
  ],
};

export const LOOT_ASIDE = {
  updated: {
    label: 'Last updated',
    /** PLACEHOLDER author and date. */
    value: 'By Ledgerline · before the Forever launch',
    text: 'Changes are posted in #announcements and the page shows who changed what.',
  },
  applying: {
    title: 'Applying?',
    text: "The application asks you to confirm you've read this page. Nobody checks — but the council assumes you have.",
    linkLabel: 'Open the form →',
  },
};
