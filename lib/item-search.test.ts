import { describe, expect, it } from 'vitest';
import { filterItems, itemSources, sourceDetails, sourceLabel } from './item-search';

const items = [{ name: 'Shard of the Scale' }, { name: 'Deathbringer' }, { name: 'Scale of Onyxia' }];

describe('item search', () => {
  it('matches partial names regardless of case and trims surrounding whitespace', () => {
    expect(filterItems(items, '  ScAlE  ').map((i) => i.name)).toEqual(['Scale of Onyxia', 'Shard of the Scale']);
  });
  it('clearing restores the sorted list, without mutating its input', () => {
    const expected = ['Deathbringer', 'Scale of Onyxia', 'Shard of the Scale'];
    expect(filterItems(items, '').map((i) => i.name)).toEqual(expected);
    expect(filterItems(items, '   ').map((i) => i.name)).toEqual(expected);
    expect(items[0].name).toBe('Shard of the Scale');
  });
  it('handles no matches and empty tables', () => {
    expect(filterItems(items, 'thunderfury')).toEqual([]);
    expect(filterItems([], '')).toEqual([]);
  });
});

describe('item sources', () => {
  const sources = itemSources([
    { id: 'ony', name: 'Onyxia', isTrash: false, itemIds: [1, 2, 2] },
    { id: 'nef', name: 'Nefarian', isTrash: false, itemIds: [2] },
    { id: 'trash', name: 'Trash mobs', isTrash: true, itemIds: [3] },
  ]);
  it('labels single-boss and trash items', () => {
    expect(sourceLabel(sources.get(1)!)).toBe('Onyxia');
    expect(sourceDetails(sources.get(1)!)).toBe('Drops from Onyxia');
    expect(sourceLabel(sources.get(3)!)).toBe('Trash');
    expect(sourceDetails(sources.get(3)!)).toBe('Trash');
  });
  it('deduplicates entries while retaining every boss for shared items', () => {
    expect(sources.get(2)).toEqual(['Onyxia', 'Nefarian']);
    expect(sourceLabel(sources.get(2)!)).toBe('Shared');
    expect(sourceDetails(sources.get(2)!)).toBe('Drops from Onyxia and Nefarian');
  });
  it('joins three or more sources and handles missing sources', () => {
    expect(sourceDetails(['A', 'B', 'C'])).toBe('Drops from A, B and C');
    expect(sourceDetails([])).toBe('');
    expect(sourceLabel([])).toBe('');
    expect(itemSources([]).size).toBe(0);
  });
});
