/** Member loot copy: the raid page's loot list and the loot history page. */
export const RAID_LOOT = {
  heading: 'Loot',
  lede: 'In the order officers record it.',
  live: 'Updates every 30 seconds during the raid.',
  empty: 'Nothing recorded yet.',
  refreshFailed: "Loot couldn't update. Trying again.",
  columns: ['Item', 'Winner', 'Method · roll', 'Boss'],
  deleted: 'deleted',
};

export const LOOT_HISTORY = {
  eyebrow: 'Members', title: 'Loot history',
  lede: 'Every item handed out in our raids, newest raid first. Pick a character to see everything they’ve won. Raid dates are in guild time.',
  emptyTitle: 'No loot recorded yet',
  empty: 'Officers record each drop during the raid, and it shows up here.',
  older: 'Show older raids',
  clear: 'Clear filters',
  noResults: 'No loot matches those filters.',
  total: (total: number) => `${total} ${total === 1 ? 'award' : 'awards'}`,
  filteredTotal: (shown: number, total: number) => `${shown} of ${total} awards`,
  characterColumns: ['Item', 'Raid', 'Method · roll', 'Boss'],
};
