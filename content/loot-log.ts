/** Copy for the officer loot log on the raid detail page. */
import type { DropMode, LootMethod } from '@/lib/loot-rules';

export const METHOD_LABEL: Record<LootMethod, string> = {
  HR: 'Hard reserve',
  SR: 'Soft reserve',
  MAIN_SPEC: 'Main spec',
  OFF_SPEC: 'Off spec',
  OPEN_ROLL: 'Open roll',
  DISENCHANT_BANK: 'Disenchant / bank',
};

export const LOOT_LOG = {
  heading: 'Loot log',
  lede: 'Pick the boss and the item; the log shows who may roll under the reserve rules. Record the winner and the roll. A mistake is voided, never deleted.',
  boss: 'Boss',
  item: 'Item',
  pickBoss: 'Pick a boss',
  pickItem: 'Pick an item',
  mode: {
    HR: 'Hard reserved: only these members roll.',
    SR: 'No hard reserves: soft reserves roll.',
    OPEN: 'Nobody reserved it: open roll.',
  } satisfies Record<DropMode, string>,
  winner: 'Winner',
  pickWinner: 'Pick who won',
  contenders: 'Who rolls',
  everyone: 'Everyone else signed up',
  roll: 'Roll (optional)',
  method: 'Method',
  note: 'Note (optional)',
  record: 'Record',
  disenchant: 'Disenchant / bank',
  recorded: (item: string, who: string) => `${item} to ${who}`,
  banked: (item: string) => `${item} disenchanted or banked`,
  listHeading: 'Recorded',
  listEmpty: 'Nothing recorded yet.',
  trash: 'Trash',
  by: (name: string) => `by ${name}`,
  void: 'Void',
  voidTitle: 'Void this record?',
  voidBody: 'It stays in the log, struck through, and stops counting: the item can drop to its reserve holders again and an HR win no longer blocks that character. Record the right winner separately.',
  voidReason: 'Reason (optional)',
  voidConfirm: 'Void the record',
  cancel: 'Cancel',
  voided: 'Record voided',
  voidedLabel: 'Voided',
  noCharacters: 'Nobody signed up has a character on the roster.',
};
