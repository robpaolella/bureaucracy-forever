/**
 * Home page copy. Voice: confident, plain, slightly dry. No exclamation marks.
 * Items marked PLACEHOLDER are invented (design-handover/CLAUDE.md § Content that is
 * placeholder) and must be replaced before launch. The pedigree claims are real.
 */

import { DISCORD_INVITE_URL } from '@/lib/config';

export const ANNOUNCEMENT = {
  eyebrow: 'Launch',
  text: "WoW Forever launches November 4. We're recruiting now.",
  linkLabel: 'See recruitment needs →',
  href: '/recruitment',
};

export const HERO = {
  eyebrow: 'US · Alliance · PvP',
  headline: ["Smolderweb's #1 raiding guild.", 'Now on WoW Forever.'],
  lede:
    "Bureaucracy has been raiding together since 2011. On Smolderweb we were the top guild from Molten Core through Naxx, with server firsts, the fastest clears, and a top 100 world Naxx clear. We're bringing the same crew to WoW Forever and building on what we did there.",
  /** Opens the apply modal on the Raider path. */
  primary: { label: 'Apply to raid', path: 'raider' as const },
  secondary: { label: 'Join our Discord', href: DISCORD_INVITE_URL },
};

/** The guild's three verified claims. Use as written. */
export const PEDIGREE = [
  { figure: 'Server firsts', text: 'First on Smolderweb to clear Blackwing Lair and AQ40.' },
  { figure: 'Fastest clears', text: "Held the server's fastest clear times in Molten Core, Blackwing Lair, and AQ40." },
  { figure: 'Strong community', text: 'A tight-knit community of competitive players with 10+ years of playing WoW together.' },
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

export const CLOSING = {
  headline: 'Are you ready to take your game to the next level?',
  text: "Bureaucracy is always recruiting talented players to join our core team. If you're a competitive player who wants to keep climbing, fill out an application. We read every application and will respond within a few days.",
  /** Both open the apply modal, one path each. */
  primary: { label: 'Apply to raid', path: 'raider' as const },
  secondary: { label: 'Join as a social member', path: 'social' as const },
};
