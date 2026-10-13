/**
 * Home page copy. Voice rules and approved lines: PRODUCT.md. The pedigree claims are real.
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
    "Bureaucracy has raided together since 2011. On Smolderweb, we were the top guild from Molten Core through Naxxramas, with server firsts, the fastest clear times and a top 150 regional Naxxramas clear in week one. Now we're bringing the same team to WoW Forever.",
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

/** Pre-launch: nothing is released yet, so every tier is locked with an unknown boss count. */
export const PROGRESSION: ProgressionRow[] = [
  { name: 'The Barrow Deeps', size: '10-player', state: 'locked', killed: 0, total: 0 },
  { name: 'Hyjal Summit', size: '20-player', state: 'locked', killed: 0, total: 0 },
  { name: "Onyxia's Lair", size: '40-player', state: 'locked', killed: 0, total: 0 },
];

export const CLOSING = {
  headline: 'Ready to compete?',
  text: "We're recruiting skilled, prepared raiders for WoW Forever. We read every application and respond within a few days.",
  /** Both open the apply modal, one path each. */
  primary: { label: 'Apply to raid', path: 'raider' as const },
  secondary: { label: 'Join as a social member', path: 'social' as const },
};
