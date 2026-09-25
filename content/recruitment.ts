/**
 * Recruitment. The needs table is the single source of truth for the recruitment page,
 * the home-page teaser and (later) the Discord bot's /recruiting reply. Statuses,
 * expectations and form copy are PLACEHOLDER per design-handover/CLAUDE.md; officers
 * will edit needs once the data layer exists.
 */
import { CLASS_COLORS, type Role, type WowClass } from '@/lib/design/class-colors';

export type NeedStatus = 'high' | 'medium' | 'closed';

export type ClassNeed = {
  wowClass: WowClass;
  /** One or more specs sharing a status, e.g. ['Fury', 'Arms']. */
  specs: string[];
  roles: Role[];
  status: NeedStatus;
};

export const NEED_LABEL: Record<NeedStatus, string> = {
  high: 'High need',
  medium: 'Medium',
  closed: 'Closed',
};

/** Rows as drawn in Recruitment.html. */
export const CLASS_NEEDS: ClassNeed[] = [
  { wowClass: 'warrior', specs: ['Protection'], roles: ['tank'], status: 'high' },
  { wowClass: 'warrior', specs: ['Fury', 'Arms'], roles: ['melee'], status: 'closed' },
  { wowClass: 'priest', specs: ['Holy', 'Discipline'], roles: ['healer'], status: 'high' },
  { wowClass: 'priest', specs: ['Shadow'], roles: ['ranged'], status: 'medium' },
  { wowClass: 'shaman', specs: ['Restoration'], roles: ['healer'], status: 'high' },
  { wowClass: 'shaman', specs: ['Elemental'], roles: ['ranged'], status: 'medium' },
  { wowClass: 'druid', specs: ['Restoration'], roles: ['healer'], status: 'medium' },
  { wowClass: 'druid', specs: ['Feral'], roles: ['tank', 'melee'], status: 'closed' },
  { wowClass: 'paladin', specs: ['Holy'], roles: ['healer'], status: 'medium' },
  { wowClass: 'warlock', specs: ['Destruction'], roles: ['ranged'], status: 'medium' },
  { wowClass: 'mage', specs: ['Frost', 'Fire'], roles: ['ranged'], status: 'closed' },
  { wowClass: 'hunter', specs: ['Marksmanship'], roles: ['ranged'], status: 'closed' },
  { wowClass: 'rogue', specs: ['Combat'], roles: ['melee'], status: 'closed' },
];

export type TeaserCard = { wowClass: WowClass; label: string; specs: string[]; status: NeedStatus };

const RANK: Record<NeedStatus, number> = { high: 0, medium: 1, closed: 2 };

/**
 * Home-page teaser: one card per class with an open need, specs joined, showing the
 * most urgent status. Capped to `limit`, most urgent first, table order within a status.
 */
export function teaserNeeds(needs: ClassNeed[] = CLASS_NEEDS, limit = 4): TeaserCard[] {
  const byClass = new Map<WowClass, TeaserCard>();
  for (const n of needs) {
    if (n.status === 'closed') continue;
    const card = byClass.get(n.wowClass) ?? {
      wowClass: n.wowClass,
      label: CLASS_COLORS[n.wowClass].label,
      specs: [],
      status: n.status,
    };
    card.specs.push(...n.specs);
    if (RANK[n.status] < RANK[card.status]) card.status = n.status;
    byClass.set(n.wowClass, card);
  }
  return [...byClass.values()].sort((a, b) => RANK[a.status] - RANK[b.status]).slice(0, limit);
}

export const RECRUITMENT_HEAD = {
  eyebrow: 'Recruitment',
  title: "We're filling a raid, not a bench",
  lede: 'Needs below are honest — a closed spec means closed, not "convince us". Apply anyway if you are exceptional; we will say so if you are.',
  aside: {
    label: 'Right now',
    text: 'Recruiting for the first WoW Forever lockout. Applications close when the raid is full.',
    linkLabel: 'Jump to the form →',
  },
};

export const NEEDS_SECTION = {
  title: 'Open needs by class and role',
  note: "Officers set each row from the Officers menu. Changing a status here updates the home page strip and the bot's /recruiting reply at the same time.",
};

export const EXPECTATIONS = {
  eyebrow: 'The deal',
  title: 'What we expect of a raider',
  note: 'None of this is unusual. All of it is enforced.',
  items: [
    { title: 'Both progression nights', text: 'Tuesday and Wednesday, roughly 90% of the tier. Life happens — tell us before the day.' },
    { title: 'Read the fight first', text: 'Strategy goes up in Discord before the night. Come knowing your job, not asking what it is.' },
    { title: 'Your own consumables', text: 'Flasks, potions, world buffs where they matter. The guild bank covers repairs, not your flasks.' },
    { title: 'Voice and an addon pack', text: 'In Discord for every pull. Boss timers and a logging client running — we review the logs, not our memories.' },
    { title: 'Take the call', text: 'One person calls during a pull. Disagree between pulls — we would rather hear it than lose the night.' },
    { title: 'Two weeks of trial', text: 'Full loot rights from night one. We tell you where you stand at the end, either way.' },
  ],
};

export const FORM = {
  title: 'Apply',
  lede: 'Pick a path. The Raider form asks for logs and a spec; the Social form asks for almost nothing.',
  paths: {
    raider: { title: 'Raider', text: 'You want a spot in the 40. Six questions and a logs link.' },
    social: { title: 'Social', text: 'You want the Discord and the odd alt run. Two questions.' },
  },
  logsHint: 'Any recent raid. We care more about deaths avoided than damage done.',
  availabilityQuestion: 'Can you make Tuesday and Wednesday, 8–11 PM server?',
  availabilityOptions: ['Both nights', 'One of them', 'Neither'] as const,
  wipeQuestion: 'Tell us about a wipe you caused and what you changed',
  wipePlaceholder: 'Short and honest beats long and polished.',
  /** PLACEHOLDER: the Social path's one open field is not drawn in the artboard. */
  socialQuestion: 'Anything we should know?',
  socialPlaceholder: 'How you found us, who you know here, what you play.',
  submit: 'Submit application',
  submitNote: "You'll get a Discord DM when an officer picks it up.",
  /** Shown until the applications API exists (build-order step 9). */
  notOpen: "Applications aren't open yet. Join the Discord and ask in #recruitment — that's where we'll reach you.",
};

export const NEXT_STEPS = {
  title: 'What happens next',
  steps: [
    { lead: 'Within a day', text: 'an officer claims it and reads your logs.' },
    { lead: 'A short chat', text: 'in Discord, usually fifteen minutes.' },
    { lead: 'Two-week trial', text: 'with full loot rights.' },
    { lead: 'A straight answer', text: 'at the end of it.' },
  ],
  social: {
    title: 'Not raiding?',
    text: 'Social members get the Discord, alt runs and the calendar. No attendance, no trial, no loot rules to memorise.',
  },
  questions: {
    title: 'Questions first?',
    text: 'Join the Discord and ask in #recruitment. Nobody will pressure you into applying.',
    button: 'Join Discord',
  },
};
