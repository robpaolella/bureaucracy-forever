import { describe, expect, it } from 'vitest';
import { parseIdsFile } from './loot-import';
import { mergePreview, tableStateToken, type LoadTableState } from './loot-load';

const state = (): LoadTableState => ({
  id: 'mc',
  lootBosses: [
    { id: 'first', name: 'Lucifron', position: 0, isTrash: false, entries: [{ itemId: 1, position: 0 }, { itemId: 99, position: 1 }] },
    { id: 'last', name: 'Ragnaros', position: 1, isTrash: false, entries: [] },
  ],
  reserveSettings: [{ itemId: 1, blocked: true, winLimit: 3 }],
});

describe('loot load preview', () => {
  it('uses kill order, appends new bosses and Trash, and keeps source item order', () => {
    const table = state();
    const before = structuredClone(table);
    const file = parseIdsFile({ bosses: [
      { name: 'Ragnaros', items: [5] }, { name: 'Lucifron', items: [3, 1, 2, 8] },
      { name: 'New boss', items: [6] }, { name: 'Trash', trash: true, items: [7] },
    ] });
    const preview = mergePreview(table, file, new Set([1, 2, 3, 5, 6, 7]));
    expect(preview.bosses.map((boss) => boss.name)).toEqual(['Lucifron', 'Ragnaros', 'New boss', 'Trash']);
    expect(preview.bosses[0]).toMatchObject({ add: [3, 2], already: [1], notFound: [8], isNew: false });
    expect(preview.bosses[3]).toMatchObject({ isTrash: true, isNew: true, add: [7] });
    expect(preview).toMatchObject({ added: 5, newBosses: 2 });
    expect(table).toEqual(before); // manual 99 and blocked/win-limit policy are untouched
  });

  it('reports nothing to change for a file already on the table', () => {
    const preview = mergePreview(state(), parseIdsFile({ bosses: [{ name: 'Lucifron', items: [1, 99] }] }), new Set([1, 99]));
    expect(preview).toMatchObject({ added: 0, newBosses: 0 });
    expect(preview.bosses[0]).toMatchObject({ add: [], already: [1, 99] });
  });

  it('does not silently drop unavailable ids, including on new empty bosses', () => {
    const preview = mergePreview(state(), parseIdsFile({ bosses: [{ name: 'Missing', items: [4, 5] }] }), new Set());
    expect(preview.bosses[2]).toMatchObject({ isNew: true, add: [], notFound: [4, 5] });
    expect(preview.bosses[0]).toMatchObject({ add: [], already: [], notFound: [] });
  });

  it('does not change an existing boss trash flag to the incoming value', () => {
    expect(mergePreview(state(), parseIdsFile({ bosses: [{ name: 'Lucifron', trash: true, items: [1] }] }), new Set([1])).bosses[0].isTrash).toBe(false);
  });

  it('identifies table, boss, entry ordering and reserve-policy changes', () => {
    const original = state();
    const token = tableStateToken(original);
    expect(tableStateToken(structuredClone(original))).toBe(token);
    for (const change of [
      (s: LoadTableState) => { s.id = 'other'; },
      (s: LoadTableState) => { s.lootBosses[0].name = 'renamed'; },
      (s: LoadTableState) => { s.lootBosses[0].position++; },
      (s: LoadTableState) => { s.lootBosses[0].isTrash = true; },
      (s: LoadTableState) => { s.lootBosses[0].entries[0].position++; },
      (s: LoadTableState) => { s.lootBosses[0].entries.push({ itemId: 2, position: 2 }); },
      (s: LoadTableState) => { s.reserveSettings[0].blocked = false; },
      (s: LoadTableState) => { s.reserveSettings[0].winLimit++; },
    ]) {
      const changed = structuredClone(original);
      change(changed);
      expect(tableStateToken(changed)).not.toBe(token);
    }
  });
});
