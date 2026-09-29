/** Copy for /officers/loot: the loot table for each raid tier. */
import { REFRESH_BATCH } from '@/lib/loot-table-rules';

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

export const LOOT_EDIT = {
  addBoss: 'Add boss',
  bossName: 'Boss name',
  trashLabel: 'Trash (drops from trash, not a boss)',
  addBossButton: 'Add',
  bossAdded: (name: string) => `Added ${name}`,
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  edit: 'Edit',
  editTitle: 'Edit boss',
  save: 'Save',
  cancel: 'Cancel',
  saved: 'Saved',
  moved: (name: string) => `Moved ${name}`,
  delete: 'Delete',
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteBody: 'Its item list goes with it. Loot already recorded from this boss keeps the name; reserves are per item and stay.',
  deleteConfirm: 'Delete the boss',
  deleted: (name: string) => `Deleted ${name}`,
  itemRef: 'Item id or Wowhead link',
  itemRefHint: 'A wowhead.com/classic or /forever link sets the database itself.',
  source: 'Database',
  sources: [
    { value: 'FOREVER', label: 'WoW Forever' },
    { value: 'CLASSIC', label: 'Classic' },
  ],
  addItem: 'Add item',
  itemAdded: (name: string) => `Added ${name}`,
  remove: (item: string, boss: string) => `Remove ${item} from ${boss}`,
  removed: (item: string) => `Removed ${item}`,
  refreshItem: (item: string) => `Refresh ${item} from Wowhead`,
  refreshed: (item: string) => `Refreshed ${item}`,
  refreshAll: 'Refresh items from Wowhead',
  refreshAllHint: `${REFRESH_BATCH} items per click, about half a minute per batch: Wowhead limits how fast we may ask.`,
  refreshMore: (n: number) => `Refresh the next ${Math.min(n, REFRESH_BATCH)} of ${n}`,
  refreshDone: (saved: number, failed: number) => `Refreshed ${saved} ${saved === 1 ? 'item' : 'items'}${failed ? `, ${failed} failed` : ''}`,
  failedIds: (ids: number[]) => `Wowhead had nothing for ${ids.map((id) => `#${id}`).join(', ')}.`,
};
