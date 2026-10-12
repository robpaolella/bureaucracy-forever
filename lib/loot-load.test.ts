import { beforeEach, describe, expect, it, vi } from 'vitest';
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(), $executeRaw: vi.fn(), raidTemplate: { findUnique: vi.fn() }, lootItem: { findMany: vi.fn() },
  lootBoss: { create: vi.fn(), delete: vi.fn() }, lootTableEntry: { createMany: vi.fn(), deleteMany: vi.fn() }, lootTableLoad: { create: vi.fn() },
  reserve: { findMany: vi.fn() }, lootAward: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } }));
import { parseIdsFile } from './loot-import';
import { applyLootTable, mergePreview, protectedItems, tableStateToken, type LoadTableState, type Protection } from './loot-load';

const state = (): LoadTableState => ({
  id: 'mc',
  lootBosses: [
    { id: 'first', name: 'Lucifron', position: 0, isTrash: false, entries: [{ itemId: 1, position: 0 }, { itemId: 99, position: 1 }] },
    { id: 'last', name: 'Ragnaros', position: 1, isTrash: false, entries: [] },
  ],
  reserveSettings: [{ itemId: 1, blocked: true, winLimit: 3 }],
});

describe('loot table apply writes', () => {
  const file = parseIdsFile({ bosses: [{ name: 'Lucifron', items: [1, 2, 404] }, { name: 'New', items: [3] }] });
  const input = () => ({ templateId: 'mc', file, source: 'FOREVER' as const, token: tableStateToken(state()), sourceName: 'sample.json', officerId: 'officer', officerName: 'Sample Officer' });
  beforeEach(() => {
    vi.clearAllMocks();
    tx.raidTemplate.findUnique.mockResolvedValue(state());
    tx.lootItem.findMany.mockResolvedValue([1, 2, 3, 99].map((id) => ({ id, source: 'FOREVER' })));
    tx.lootBoss.create.mockResolvedValue({ id: 'new' });
  });
  it('checks the token under the lock and refuses stale state without writes', async () => {
    expect(await applyLootTable({ ...input(), token: 'stale' })).toEqual({ ok: false, status: 409, error: 'The table changed since this preview.' });
    expect(tx.$queryRaw.mock.calls[0][1]).toBe('mc');
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.raidTemplate.findUnique.mock.invocationCallOrder[0]);
    expect(tx.lootItem.findMany).not.toHaveBeenCalled();
    expect(tx.lootBoss.create).not.toHaveBeenCalled();
    expect(tx.lootTableEntry.createMany).not.toHaveBeenCalled();
    expect(tx.lootTableLoad.create).not.toHaveBeenCalled();
  });
  it('writes matching preview additions and exactly one audit snapshot', async () => {
    const preview = mergePreview(state(), file, new Set([1, 2, 3, 99]));
    expect(await applyLootTable(input())).toEqual({ ok: true, added: preview.added, newBosses: preview.newBosses, removed: 0 });
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.lootTableEntry.deleteMany).not.toHaveBeenCalled();
    expect(tx.lootBoss.delete).not.toHaveBeenCalled();
    expect(tx.lootBoss.create).toHaveBeenCalledExactlyOnceWith({ data: { templateId: 'mc', name: 'New', isTrash: false, position: 2 }, select: { id: true } });
    expect(tx.lootTableEntry.createMany.mock.calls).toEqual([
      [{ data: [{ bossId: 'first', itemId: 2, position: 2 }] }], [{ data: [{ bossId: 'new', itemId: 3, position: 0 }] }],
    ]);
    expect(tx.lootTableLoad.create).toHaveBeenCalledExactlyOnceWith({ data: { templateId: 'mc', sourceName: 'sample.json', officerId: 'officer', officerName: 'Sample Officer', mode: 'merge', added: 2, removed: 0 } });
  });
  it('returns zero without writes or audit for a no-op', async () => {
    expect(await applyLootTable({ ...input(), file: parseIdsFile({ bosses: [{ name: 'Lucifron', items: [1, 404] }] }) })).toEqual({ ok: true, added: 0, newBosses: 0, removed: 0 });
    expect(tx.lootBoss.create).not.toHaveBeenCalled();
    expect(tx.lootTableEntry.createMany).not.toHaveBeenCalled();
    expect(tx.lootTableLoad.create).not.toHaveBeenCalled();
  });
});

// Ragnaros (absent from the file) drops 7, reserved; Lucifron keeps 1, drops 99 (awarded) and 98. Golemagg, empty, goes.
const replaceState = (): LoadTableState => ({
  id: 'mc',
  lootBosses: [
    { id: 'first', name: 'Lucifron', position: 0, isTrash: false, entries: [{ itemId: 1, position: 0 }, { itemId: 99, position: 1 }, { itemId: 98, position: 2 }] },
    { id: 'last', name: 'Ragnaros', position: 1, isTrash: false, entries: [{ itemId: 7, position: 0 }, { itemId: 8, position: 1 }] },
    { id: 'gone', name: 'Golemagg', position: 2, isTrash: false, entries: [{ itemId: 9, position: 0 }] },
    { id: 'empty', name: 'Empty', position: 3, isTrash: true, entries: [] },
  ],
  reserveSettings: [{ itemId: 98, blocked: true, winLimit: 3 }],
});
const shield: Protection = { reserves: [7, 99], awards: [99] };

describe('loot table replace', () => {
  const file = parseIdsFile({ bosses: [{ name: 'Lucifron', items: [1, 2] }, { name: 'New', items: [3] }] });
  const input = () => ({ templateId: 'mc', file, source: 'FOREVER' as const, token: tableStateToken(replaceState(), shield), sourceName: 'sample.json', officerId: 'officer', officerName: 'Sample Officer', replace: true });
  beforeEach(() => {
    vi.clearAllMocks();
    tx.raidTemplate.findUnique.mockResolvedValue(replaceState());
    tx.lootItem.findMany.mockResolvedValue([1, 2, 3].map((id) => ({ id, source: 'FOREVER' })));
    tx.lootBoss.create.mockResolvedValue({ id: 'new' });
    tx.reserve.findMany.mockResolvedValue([{ itemId: 7 }, { itemId: 99 }]);
    tx.lootAward.findMany.mockResolvedValue([{ itemId: 99 }]);
  });

  it('lists removals, keeps protected items with their boss, and removes only unprotected absent bosses', () => {
    const preview = mergePreview(replaceState(), file, new Set([1, 2, 3]), shield);
    expect(preview.bosses.map(({ name, remove, kept, absent }) => ({ name, remove, kept, absent }))).toEqual([
      { name: 'Lucifron', remove: [98], kept: [{ id: 99, has: 'awards' }], absent: null },
      { name: 'Ragnaros', remove: [8], kept: [{ id: 7, has: 'reserves' }], absent: 'keep' },
      { name: 'Golemagg', remove: [9], kept: [], absent: 'remove' },
      { name: 'Empty', remove: [], kept: [], absent: 'remove' },
      { name: 'New', remove: [], kept: [], absent: null },
    ]);
    expect(preview).toMatchObject({ added: 2, newBosses: 1, removed: 3, removedBosses: 2, kept: 2 });
    expect(mergePreview(replaceState(), file, new Set([1, 2, 3]))).toMatchObject({ removed: 0, removedBosses: 0, kept: 0 });
  });

  it('reads reserves in any raid of the tier and awards in it, voided or not', async () => {
    expect(await protectedItems(tx as never, replaceState())).toEqual({ reserves: [7, 99], awards: [99] });
    const where = { itemId: { in: [1, 99, 98, 7, 8, 9] }, raid: { templateId: 'mc' } };
    expect(tx.reserve.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(tx.lootAward.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it('covers protection in the token, apart from the merge token', () => {
    const token = tableStateToken(replaceState(), shield);
    expect(token).not.toBe(tableStateToken(replaceState()));
    expect(tableStateToken(replaceState(), { ...shield, reserves: [7, 8, 99] })).not.toBe(token);
    expect(tableStateToken(replaceState(), { ...shield, awards: [] })).not.toBe(token);
  });

  it('locks awards, recomputes protection, removes, adds and audits replace; reserve settings stay', async () => {
    expect(await applyLootTable(input())).toEqual({ ok: true, added: 2, newBosses: 1, removed: 3 });
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.raidTemplate.findUnique.mock.invocationCallOrder[0]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.$executeRaw.mock.invocationCallOrder[0]);
    expect(tx.lootTableEntry.deleteMany.mock.calls).toEqual([[{ where: { bossId: 'first', itemId: { in: [98] } } }], [{ where: { bossId: 'last', itemId: { in: [8] } } }]]);
    expect(tx.lootBoss.delete.mock.calls).toEqual([[{ where: { id: 'gone' } }], [{ where: { id: 'empty' } }]]);
    expect(tx.lootBoss.create).toHaveBeenCalledExactlyOnceWith({ data: { templateId: 'mc', name: 'New', isTrash: false, position: 4 }, select: { id: true } });
    // No reserve-setting client exists on tx: the blocked 98's setting can't be touched.
    expect(tx.lootTableLoad.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ mode: 'replace', added: 2, removed: 3 }) });
  });

  it('refuses as stale, without writes, when a reserve or award appeared after the preview', async () => {
    for (const later of [() => tx.reserve.findMany.mockResolvedValue([{ itemId: 7 }, { itemId: 8 }, { itemId: 99 }]), () => tx.lootAward.findMany.mockResolvedValue([{ itemId: 9 }, { itemId: 99 }])]) {
      vi.clearAllMocks();
      tx.raidTemplate.findUnique.mockResolvedValue(replaceState());
      tx.reserve.findMany.mockResolvedValue([{ itemId: 7 }, { itemId: 99 }]);
      tx.lootAward.findMany.mockResolvedValue([{ itemId: 99 }]);
      later();
      expect(await applyLootTable(input())).toEqual({ ok: false, status: 409, error: 'The table changed since this preview.' });
      expect(tx.lootTableEntry.deleteMany).not.toHaveBeenCalled();
      expect(tx.lootBoss.delete).not.toHaveBeenCalled();
      expect(tx.lootTableLoad.create).not.toHaveBeenCalled();
    }
  });

  it('audits a replace that removes nothing as replace with removed 0', async () => {
    const table = replaceState();
    table.lootBosses = [{ ...table.lootBosses[0], entries: [{ itemId: 1, position: 0 }] }];
    tx.raidTemplate.findUnique.mockResolvedValue(table);
    tx.reserve.findMany.mockResolvedValue([]); tx.lootAward.findMany.mockResolvedValue([]);
    const token = tableStateToken(table, { reserves: [], awards: [] });
    expect(await applyLootTable({ ...input(), token })).toEqual({ ok: true, added: 2, newBosses: 1, removed: 0 });
    expect(tx.lootTableEntry.deleteMany).not.toHaveBeenCalled();
    expect(tx.lootTableLoad.create).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ mode: 'replace', added: 2, removed: 0 }) });
  });
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
