import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), find: vi.fn(), one: vi.fn(), upsert: vi.fn(), holders: vi.fn(), remove: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {
  $transaction: mocks.transaction,
  $queryRaw: mocks.query,
  lootReserveSetting: { findMany: mocks.find, findUnique: mocks.one, upsert: mocks.upsert },
  reserve: { findMany: mocks.holders, deleteMany: mocks.remove },
} }));
import { db } from '@/lib/db';
import { blockItem, blockedItemIds, itemWinLimit, setItemBlocked, setItemWinLimit, unlockedHolders, winLimits } from './loot-blocks';

const NOW = new Date('2026-10-05T18:00:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((run) => run(db));
  mocks.query.mockResolvedValue([{ id: 't1' }]);
  mocks.find.mockResolvedValue([]);
  mocks.holders.mockResolvedValue([]);
  mocks.remove.mockResolvedValue({ count: 0 });
});

const row = (raidId: string, characterId: string, kind: 'HR' | 'SR', cancelled = false) => ({
  raidId, characterId, kind, character: { name: `Char ${characterId}` },
  raid: { name: 'Sample raid', startsAt: new Date('2026-10-08T03:00:00Z'), cancelledAt: cancelled ? new Date('2026-10-05T00:00:00Z') : null },
});
// Starts later than now + 120 minutes: locked and past raids don't count; no cancelled filter.
const UNLOCKED = { itemId: 100, raid: { templateId: 't1', startsAt: { gt: new Date('2026-10-05T20:00:00Z') } } };

describe('tier reserve settings', () => {
  it('defaults to no blocks, and reads only blocked items in the requested tier', async () => {
    expect(await blockedItemIds('t1')).toEqual(new Set());
    mocks.find.mockResolvedValue([{ itemId: 100 }]);
    expect(await blockedItemIds('t1')).toEqual(new Set([100]));
    expect(mocks.find).toHaveBeenLastCalledWith({ where: { templateId: 't1', blocked: true }, select: { itemId: true } });
  });

  it.each([true, false])('locks before setting blocked=%s, without removing reserves or other settings', async (blocked) => {
    expect(await setItemBlocked('t1', 100, blocked, NOW)).toEqual({ ok: true });
    expect(mocks.query.mock.calls[0][0].join('?')).toBe('SELECT "id" FROM "RaidTemplate" WHERE "id" = ? FOR NO KEY UPDATE');
    expect(mocks.query.mock.calls[0][1]).toBe('t1');
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(mocks.upsert.mock.invocationCallOrder[0]);
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { templateId_itemId: { templateId: 't1', itemId: 100 } }, create: { templateId: 't1', itemId: 100, blocked }, update: { blocked } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  });

  it('a direct block is refused, writing nothing, while anyone holds the item on an unlocked raid', async () => {
    mocks.holders.mockResolvedValue([row('r1', 'c1', 'HR'), row('r1', 'c2', 'SR')]);
    expect(await setItemBlocked('t1', 100, true, NOW)).toEqual({ ok: false, holders: 2 });
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(mocks.holders.mock.invocationCallOrder[0]);
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('unblocks whatever is held, without reading holders', async () => {
    expect(await setItemBlocked('t1', 100, false, NOW)).toEqual({ ok: true });
    expect(mocks.holders).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it('lists holders on unlocked raids of this tier, cancelled raids included, by raid then name', async () => {
    mocks.holders.mockResolvedValue([row('r1', 'c1', 'HR', true)]);
    expect(await unlockedHolders(db, 't1', 100, NOW)).toEqual([
      { key: 'r1:c1:HR', character: 'Char c1', kind: 'HR', raid: { id: 'r1', name: 'Sample raid', startsAt: '2026-10-08T03:00:00.000Z', cancelled: true } },
    ]);
    expect(mocks.holders).toHaveBeenCalledWith(expect.objectContaining({
      where: UNLOCKED,
      orderBy: [{ raid: { startsAt: 'asc' } }, { raidId: 'asc' }, { character: { name: 'asc' } }],
    }));
  });
});

describe('blocking with the holders the officer confirmed', () => {
  it('removes the confirmed reserves on unlocked raids and blocks, under the lock, in one transaction', async () => {
    mocks.holders.mockResolvedValue([row('r1', 'c1', 'HR'), row('r2', 'c2', 'SR', true)]);
    mocks.remove.mockResolvedValue({ count: 2 });
    expect(await blockItem('t1', 100, ['r1:c1:HR', 'r2:c2:SR'], NOW)).toEqual({ ok: true, removed: 2 });
    expect(mocks.remove).toHaveBeenCalledWith({ where: UNLOCKED });
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { templateId_itemId: { templateId: 't1', itemId: 100 } }, create: { templateId: 't1', itemId: 100, blocked: true }, update: { blocked: true } });
    const [lock] = mocks.query.mock.invocationCallOrder;
    expect(lock).toBeLessThan(mocks.holders.mock.invocationCallOrder[0]);
    expect(mocks.holders.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0]);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  });

  it('refuses a stale list, writing nothing, when a holder appeared or changed slot since it was shown', async () => {
    mocks.holders.mockResolvedValue([row('r1', 'c1', 'SR'), row('r1', 'c2', 'HR')]);
    const result = await blockItem('t1', 100, ['r1:c1:HR', 'r1:c2:HR'], NOW);
    expect(result).toMatchObject({ ok: false, holders: [{ key: 'r1:c1:SR' }, { key: 'r1:c2:HR' }] });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('still blocks when a confirmed holder dropped their reserve meanwhile, counting what it removed', async () => {
    mocks.holders.mockResolvedValue([row('r1', 'c2', 'SR')]);
    mocks.remove.mockResolvedValue({ count: 1 });
    expect(await blockItem('t1', 100, ['r1:c1:HR', 'r1:c2:SR'], NOW)).toEqual({ ok: true, removed: 1 });
  });

  it('blocks an item nobody holds without deleting anything', async () => {
    expect(await blockItem('t1', 100, [], NOW)).toEqual({ ok: true, removed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it('a failure part-way rejects, so the transaction rolls the removal back', async () => {
    mocks.holders.mockResolvedValue([row('r1', 'c1', 'HR')]);
    mocks.upsert.mockRejectedValue(new Error('connection lost'));
    await expect(blockItem('t1', 100, ['r1:c1:HR'], NOW)).rejects.toThrow('connection lost');
  });
});

describe('win limits', () => {
  it('reads limits above 1 for the tier; any other item reads as 1', async () => {
    expect(await winLimits('t1')).toEqual({});
    mocks.find.mockResolvedValue([{ itemId: 100, winLimit: 2 }, { itemId: 200, winLimit: 5 }]);
    expect(await winLimits('t1')).toEqual({ 100: 2, 200: 5 });
    expect(mocks.find).toHaveBeenLastCalledWith({ where: { templateId: 't1', winLimit: { gt: 1 } }, select: { itemId: true, winLimit: true } });
  });

  it('reads one item, 1 when it has no setting', async () => {
    mocks.one.mockResolvedValue(null);
    expect(await itemWinLimit('t1', 100)).toBe(1);
    mocks.one.mockResolvedValue({ winLimit: 1 });
    expect(await itemWinLimit('t1', 100)).toBe(1);
    mocks.one.mockResolvedValue({ winLimit: 3 });
    expect(await itemWinLimit('t1', 100)).toBe(3);
    expect(mocks.one).toHaveBeenLastCalledWith({ where: { templateId_itemId: { templateId: 't1', itemId: 100 } }, select: { winLimit: true } });
  });

  it('sets the limit under the tier lock, keeping blocked and every reserve', async () => {
    await setItemWinLimit('t1', 100, 2);
    expect(mocks.query.mock.calls[0][0].join('?')).toBe('SELECT "id" FROM "RaidTemplate" WHERE "id" = ? FOR NO KEY UPDATE');
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(mocks.upsert.mock.invocationCallOrder[0]);
    // A new row is unblocked by the column default; an existing row keeps its blocked value.
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { templateId_itemId: { templateId: 't1', itemId: 100 } }, create: { templateId: 't1', itemId: 100, winLimit: 2 }, update: { winLimit: 2 } });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.holders).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  });

  it.each([true, false])('blocked=%s leaves the stored limit alone', async (blocked) => {
    await setItemBlocked('t1', 100, blocked, NOW);
    expect(mocks.upsert.mock.calls[0][0].update).toEqual({ blocked });
    expect(mocks.upsert.mock.calls[0][0].create).not.toHaveProperty('winLimit');
  });
});
