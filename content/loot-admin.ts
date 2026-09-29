/** Copy for /officers/loot: the loot table for each raid tier. */

export const LOOT_ADMIN_HEAD = {
  eyebrow: 'Officers',
  title: 'Loot tables',
  lede: 'What each raid drops, boss by boss. Reserves and the loot log offer only these items.',
};

export const LOOT_TABLES = {
  heading: 'Raid tiers',
  empty: 'No raid templates yet. Add one under Raid management first.',
  open: 'Open',
  inactive: 'Inactive',
  counts: (bosses: number, items: number) => (bosses === 0 ? 'No loot table yet' : `${bosses} ${bosses === 1 ? 'entry' : 'entries'} · ${items} ${items === 1 ? 'item' : 'items'}`),
};

export const LOOT_TABLE = {
  back: 'All loot tables',
  trash: 'Trash',
  empty: 'No bosses yet.',
  noItems: 'No items on this boss yet.',
  itemId: (id: number) => `#${id}`,
};
