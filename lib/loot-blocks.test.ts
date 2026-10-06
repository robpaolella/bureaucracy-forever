import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), find: vi.fn(), upsert: vi.fn(), count: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {
  $transaction: mocks.transaction,
  $queryRaw: mocks.query,
  lootReserveSetting: { findMany: mocks.find, upsert: mocks.upsert },
  reserve: { count: mocks.count },
} }));
import { db } from '@/lib/db';
import { blockedItemIds, setItemBlocked, unlockedHolderCount } from './loot-blocks';

const NOW = new Date('2026-10-05T18:00:00Z');

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((run) => run(db));
  mocks.query.mockResolvedValue([{ id: 't1' }]);
  mocks.find.mockResolvedValue([]);
  mocks.count.mockResolvedValue(0);
});

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

  it('counts holders under the lock and refuses a block, writing nothing, while anyone holds the item on an unlocked raid', async () => {
    mocks.count.mockResolvedValue(2);
    expect(await setItemBlocked('t1', 100, true, NOW)).toEqual({ ok: false, holders: 2 });
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(mocks.count.mock.invocationCallOrder[0]);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('unblocks whatever is held, without counting holders', async () => {
    mocks.count.mockResolvedValue(2);
    expect(await setItemBlocked('t1', 100, false, NOW)).toEqual({ ok: true });
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it('holders are reserves on this tier whose raid starts after the 2-hour reserve lock, cancelled raids included', async () => {
    mocks.count.mockResolvedValue(1);
    expect(await unlockedHolderCount(db, 't1', 100, NOW)).toBe(1);
    // Starts later than now + 120 minutes: locked and past raids don't count; no cancelled filter.
    expect(mocks.count).toHaveBeenCalledWith({ where: { itemId: 100, raid: { templateId: 't1', startsAt: { gt: new Date('2026-10-05T20:00:00Z') } } } });
  });
});
