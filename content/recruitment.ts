/**
 * Recruitment. The needs table is the single source of truth for the recruitment page,
 * the home-page teaser and the Discord bot's /recruitment command. Statuses,
 * expectations and form copy are PLACEHOLDER per design-handover/CLAUDE.md; officers
 * will edit needs once the data layer exists.
 */
import type { Role, WowClass } from '@/lib/design/class-colors';

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

export const RECRUITMENT_HEAD = {
  eyebrow: 'Recruitment',
  title: 'Join a raid team built to compete',
  lede: "The table below shows the classes and specs we need most. If your spec is closed and you're an exceptional player, we still want to hear from you.",
  aside: {
    label: 'Right now',
    text: 'We read every application and respond within a few days.',
    linkLabel: 'Jump to the form →',
  },
};

export const NEEDS_SECTION = {
  title: 'Open needs by class and role',
};

export const EXPECTATIONS = {
  eyebrow: 'The deal',
  title: 'What we expect of a raider',
  items: [
    { title: 'Both progression nights', text: "Raiders attend both progression nights. If you can't make one, let us know in Discord ahead of time." },
    { title: 'Come prepared', text: 'We expect every raider to show up prepared, with consumables, enchants and gear ready to go.' },
    { title: 'In Discord for every raid', text: 'Every raid runs in Discord voice, and every raider is in it.' },
    { title: 'Two-week trial', text: "New raiders start with a two-week trial. Gear isn't awarded during the trial." },
  ],
};

export const FORM = {
  title: 'Apply',
  lede: 'Pick a path. The Raider form asks for logs and a spec; the Social form asks for almost nothing.',
  paths: {
    raider: { title: 'Raider', text: 'You want a spot in the 40. Six questions and a logs link.' },
    social: { title: 'Social', text: 'You want the Discord and the odd alt run. Two questions.' },
  },
  /** WoW Forever names are two parts, each up to twelve letters, as the game allows. */
  firstName: 'First name',
  secondName: 'Second name',
  nameHint: 'Both parts, exactly as in game.',
  logsHint: 'Any recent raid. We care more about deaths avoided than damage done.',
  /** Pre-launch: no raid days yet, so the question names none. */
  availabilityQuestion: "Can you make both progression nights once they're set?",
  availabilityHint: "Days and times are still TBD. Officers pick them from members' availability.",
  availabilityOptions: ['Both nights', 'One of them', 'Neither'] as const,
  pitchQuestion: "Please tell us why you'd be a good addition to our team.",
  pitchPlaceholder: 'Short and honest beats long and polished.',
  /** PLACEHOLDER: the Social path's one open field is not drawn in the artboard. */
  socialQuestion: 'Anything we should know?',
  socialPlaceholder: 'How you found us, who you know here, what you play.',
  submit: 'Submit application',
  submitNote: "You'll get a Discord DM when an officer picks it up.",
  tooMany: 'That is a lot of applications from one place. Wait an hour, or ask in #recruitment.',
  duplicate: 'An application for this character is already waiting on an officer.',
  duplicateAccount: 'You already have an application waiting on an officer.',
  signInRequired: 'Sign in with Discord first, then submit again.',
};

/** docs/04 § Application submitted. */
export const SUBMITTED = {
  eyebrow: 'Received',
  title: 'Your application is in',
  body: "Thanks for applying. We'll get back to you on Discord within a few days. If you have a question in the meantime, ask an officer in our Discord.",
  summary: { character: 'Character', wowClass: 'Class', spec: 'Spec', path: 'Path' },
  paths: { raider: 'Raider', social: 'Social' },
  join: 'Join Discord',
  back: 'Back to the site',
  mistake: 'Applied by mistake or need to change something? Ask an officer in our Discord.',
};

/** SYNC-SPEC §9.1: /apply sits behind a Discord sign-in and a guild-membership check. */
export const APPLY_GATE = {
  eyebrow: 'Apply',
  signInTitle: 'Sign in with Discord to apply',
  signInBody: "Applications are tied to your Discord account so officers can reach you and so one person applies once. If you're not in the server yet, join first; the sign-in follows.",
  signIn: 'Sign in with Discord',
  joinTitle: "You're not in our Discord yet",
  joinBody: "Join the server first, then come back to this page. Officers decide applications in Discord and reach you there.",
  join: 'Join Discord',
  retry: "I've joined — try again",
  checking: 'Checking your Discord sign-in…',
};

/** The recruitment page's apply section: two doors to the apply modal (SYNC-SPEC §9.1). */
export const APPLY_LINKS = {
  raider: { label: 'Apply as a Raider', path: 'raider' as const },
  social: { label: 'Apply as Social', path: 'social' as const },
  note: "You'll sign in with Discord before the form opens, so join the server first.",
};

export const NEXT_STEPS = {
  title: 'What happens next',
  steps: [
    { lead: 'Within a few days', text: "you'll hear back from us." },
    { lead: 'A short chat', text: 'in Discord.' },
    { lead: 'Two-week trial', text: 'for new raiders.' },
  ],
  social: {
    title: 'Not raiding?',
    text: 'You can also apply as a social member.',
  },
  questions: {
    title: 'Questions first?',
    text: 'Ask an officer in our Discord.',
    button: 'Join Discord',
  },
};
