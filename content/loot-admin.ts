/** Copy for /officers/loot: the loot table for each raid tier. */
import { REFRESH_BATCH } from '@/lib/loot-table-rules';

const reserves = (n: number) => `${n} ${n === 1 ? 'reserve' : 'reserves'}`;

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
  trashLabel: 'Trash drops',
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

/** The "Load table" window (design #203), file source only; AtlasLoot and replace arrive in #125 and #126. */
const items = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`;
const bosses = (n: number) => `${n} ${n === 1 ? 'boss' : 'bosses'}`;
export const LOOT_LOAD = {
  title: 'Load table',
  fileLabel: 'Loot list file (.json)',
  chooseFile: 'Choose file',
  noFile: 'No file chosen',
  fileHint: 'A list of bosses, each with its item ids, in kill order.',
  confirmHint: 'Nothing is written until you confirm.',
  preview: 'Preview',
  cancel: 'Cancel',
  close: 'Close',
  back: 'Back',
  stop: 'Stop',
  retry: 'Retry',
  tryAgain: 'Try again',
  previewAgain: 'Preview again',
  stoppedTitle: 'Stopped. Nothing was loaded.',
  stoppedBody: 'Items fetched so far are saved, so the next try is quicker.',
  fetching: 'Fetching items from Wowhead:',
  fetchCount: (completed: number, total: number) => `${completed} of ${total}`,
  /** Wowhead allows about one item a second. */
  timeLeft: (left: number) => (left > 70 ? 'About two minutes left.' : left > 10 ? 'About a minute left.' : 'Almost done.'),
  fetchingHint: 'Wowhead limits how fast we may ask. Keep this window open.',
  reading: (name: string) => `Reading ${name}. Nothing is written until you confirm.`,
  nothingTitle: 'Nothing to change',
  nothingBody: 'The table already matches this file.',
  summaryAdds: 'Adds',
  summaryItems: items,
  summaryRest: (newBosses: number, existing: number) => `: ${newBosses} new ${newBosses === 1 ? 'boss' : 'bosses'} and ${bosses(existing)} already on the table. Nothing is removed.`,
  notFound: (n: number) => `Wowhead couldn’t find ${items(n)}`,
  notFoundHint: 'They won’t be loaded. Check the ids in the file, or try again if Wowhead was busy.',
  adds: 'Adds',
  newBoss: 'New boss',
  trash: 'Trash',
  counts: (added: number, already: number, notFound: number) =>
    [`${added} new`, already && `${already} already on the table`, notFound && `${notFound} not found`].filter(Boolean).join(' · '),
  from: (name: string) => `From ${name} · merge`,
  load: (n: number) => `Load ${items(n)}`,
  loaded: (name: string, n: number) => `Loaded ${name}: added ${items(n)}.`,
  stillMissing: (n: number) => `Wowhead still couldn’t find ${items(n)}.`,
};

/** The "Reserves" window for one item: settings shared by every boss in the tier (design #131). */
export const LOOT_RESERVES = {
  button: 'Reserves',
  buttonLabel: (item: string) => `Reserves for ${item}`,
  title: (item: string) => `Reserves: ${item}`,
  open: 'Open to reserves',
  shared: (bosses: string[]) => `Also drops from ${bosses.length > 1 ? `${bosses.slice(0, -1).join(', ')} and ${bosses[bosses.length - 1]}` : bosses[0]}. This setting applies there too.`,
  done: 'Done',
  blockedTag: 'Not open to reserves',
  limitTag: (n: number) => `Win limit ${n}`,
  limit: 'Win limit',
  lower: 'Lower the win limit',
  raise: 'Raise the win limit',
  limitHint: 'How many times one character can win this through a hard or soft reserve.',
  limitMax: (max: number) => `${max} is the most.`,
  limitBlocked: "Blocked items can't be reserved, whatever the limit.",
  raised: (n: number) => `Win limit ${n}.`,
  lowered: (n: number) => `Win limit ${n}. Existing reserves stay.`,
  blocked: (item: string) => `Blocked ${item}.`,
  unblocked: (item: string) => `${item} is open to reserves again. Removed reserves aren't restored.`,
  retry: 'Retry',
  confirmTitle: (item: string) => `Block ${item}?`,
  confirmLead: "Blocking removes these reserves on raids that haven't locked yet:",
  stale: 'The list changed since you opened this. Check it and confirm again.',
  /** "Wed, Oct 7": a raid's date in `zone`. The time beside it is LocalTime's. */
  raidDate: (startsAt: Date, zone: string) => new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', month: 'short', day: 'numeric' }).format(startsAt),
  cancelled: 'Cancelled',
  confirmFoot: "Reserves on locked and past raids stay. They won't be told. Let them know in Discord.",
  cancel: 'Cancel',
  confirm: (n: number) => `Block and remove ${reserves(n)}`,
  blockedRemoved: (item: string, n: number) => `Blocked ${item}. Removed ${reserves(n)}.`,
};
