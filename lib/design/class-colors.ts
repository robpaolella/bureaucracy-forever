/**
 * WoW class colors — the one game convention this site borrows.
 *
 * `canonical` is the in-game value. Use it for exports, addon parity, and anything
 * a member might compare against their UI.
 *
 * `onInk` is what the web uses. Shaman and Warlock fall below 4.5:1 against
 * --ink-950 (#06080B) at their canonical values, so they are lifted. Everything
 * else is unchanged — `onInk === canonical` for the other seven.
 *
 * Only ever applied to text: character names, class labels, role counts.
 * Never a background fill.
 */

export const CLASSES = [
  'warrior', 'paladin', 'hunter', 'rogue', 'priest',
  'shaman', 'mage', 'warlock', 'druid',
] as const;

export type WowClass = (typeof CLASSES)[number];

export const CLASS_COLORS: Record<WowClass, { label: string; canonical: string; onInk: string }> = {
  warrior: { label: 'Warrior', canonical: '#C79C6E', onInk: '#C79C6E' },
  paladin: { label: 'Paladin', canonical: '#F58CBA', onInk: '#F58CBA' },
  hunter:  { label: 'Hunter',  canonical: '#ABD473', onInk: '#ABD473' },
  rogue:   { label: 'Rogue',   canonical: '#FFF569', onInk: '#FFF569' },
  priest:  { label: 'Priest',  canonical: '#FFFFFF', onInk: '#F2F2F2' },
  shaman:  { label: 'Shaman',  canonical: '#0070DE', onInk: '#3A9BE8' },
  mage:    { label: 'Mage',    canonical: '#69CCF0', onInk: '#69CCF0' },
  warlock: { label: 'Warlock', canonical: '#9482C9', onInk: '#9C8BD8' },
  druid:   { label: 'Druid',   canonical: '#FF7D0A', onInk: '#FF7D0A' },
};

export const ROLES = ['tank', 'healer', 'melee', 'ranged'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee DPS',
  ranged: 'Ranged DPS',
};

/** Short forms for the officer heatmap tooltip and window results: "2T · 8H · 9M · 11R". */
export const ROLE_SHORT: Record<Role, string> = {
  tank: 'T', healer: 'H', melee: 'M', ranged: 'R',
};

/** Classic-era specs per class, and the role each one fills. */
export const SPECS: Record<WowClass, { name: string; roles: Role[] }[]> = {
  warrior: [{ name: 'Protection', roles: ['tank'] }, { name: 'Fury', roles: ['melee'] }, { name: 'Arms', roles: ['melee'] }],
  paladin: [{ name: 'Holy', roles: ['healer'] }, { name: 'Protection', roles: ['tank'] }, { name: 'Retribution', roles: ['melee'] }],
  hunter:  [{ name: 'Marksmanship', roles: ['ranged'] }, { name: 'Beast Mastery', roles: ['ranged'] }],
  rogue:   [{ name: 'Combat', roles: ['melee'] }, { name: 'Assassination', roles: ['melee'] }],
  priest:  [{ name: 'Holy', roles: ['healer'] }, { name: 'Discipline', roles: ['healer'] }, { name: 'Shadow', roles: ['ranged'] }],
  shaman:  [{ name: 'Restoration', roles: ['healer'] }, { name: 'Elemental', roles: ['ranged'] }, { name: 'Enhancement', roles: ['melee'] }],
  mage:    [{ name: 'Frost', roles: ['ranged'] }, { name: 'Fire', roles: ['ranged'] }, { name: 'Arcane', roles: ['ranged'] }],
  warlock: [{ name: 'Destruction', roles: ['ranged'] }, { name: 'Affliction', roles: ['ranged'] }, { name: 'Demonology', roles: ['ranged'] }],
  druid:   [{ name: 'Restoration', roles: ['healer'] }, { name: 'Feral', roles: ['tank', 'melee'] }, { name: 'Balance', roles: ['ranged'] }],
};
