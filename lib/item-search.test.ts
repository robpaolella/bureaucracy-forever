import { describe, expect, it } from 'vitest';
import { filterItems, searchableItems } from './item-search';
import type { LootTableView } from './loot-data';

const table: LootTableView = {
  items: Object.fromEntries([[1, 'Zebra Blade'], [2, 'Ashen Band'], [3, 'Dusty Signet']].map(([id, name]) => [id, { id: Number(id), name: String(name), quality: 4, icon: 'inv_sword_04', tooltipHtml: '' }])),
  bosses: [
    { id: 'a', name: 'First boss', isTrash: false, itemIds: [1, 2, 2, 999] },
    { id: 'b', name: 'Second boss', isTrash: false, itemIds: [2] },
    { id: 'c', name: 'Hallway', isTrash: true, itemIds: [3] },
  ],
};

describe('searchableItems', () => {
  it('deduplicates and sorts by item name, ignoring missing items without mutating input', () => {
    const original = structuredClone(table);
    expect(searchableItems(table).map(({ item }) => item.id)).toEqual([2, 3, 1]);
    expect(table).toEqual(original);
  });
  it('shows Shared once and preserves every boss name', () => {
    expect(searchableItems(table)[0]).toMatchObject({ bossLabel: 'Shared', bosses: ['First boss', 'Second boss'] });
  });
  it('labels trash and single-boss drops', () => {
    expect(searchableItems(table)[1]).toMatchObject({ bossLabel: 'Trash', bosses: ['Trash'] });
    expect(searchableItems(table)[2]).toMatchObject({ bossLabel: 'First boss', bosses: ['First boss'] });
  });
  it('handles an empty table', () => {
    expect(searchableItems({ items: {}, bosses: [] })).toEqual([]);
  });
});

describe('filterItems', () => {
  const rows = searchableItems(table);
  it('matches partial names case-insensitively and trims the query', () => {
    expect(filterItems(rows, '  HEN bA  ').map(({ item }) => item.id)).toEqual([2]);
  });
  it('restores every row for empty or whitespace input', () => {
    expect(filterItems(rows, '')).toEqual(rows);
    expect(filterItems(rows, '  ')).toEqual(rows);
  });
  it('does not search boss names, counts or quality', () => {
    for (const term of ['First boss', 'HR 1', 'Epic', 'no match']) expect(filterItems(rows, term)).toEqual([]);
  });
});
