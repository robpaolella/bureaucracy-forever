/** Member-facing raid loot; officer audit details never appear here. */
export const RAID_LOOT = {
  heading: 'Loot',
  updated: (count: number) => `Loot updated. ${count} ${count === 1 ? 'award' : 'awards'} recorded.`,
  empty: 'Nothing recorded yet.',
  lede: 'In the order recorded. Updates every 30 seconds during the raid.',
  refreshFailed: 'Loot could not update. Retrying automatically; refresh the page if this continues.',
  winner: 'Winner',
  method: 'Method',
  roll: 'Roll',
  boss: 'Boss',
  unknownWinner: 'Character no longer available',
};
