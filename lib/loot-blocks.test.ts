import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), find: vi.fn(), upsert: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {
  $transaction: mocks.transaction,
  $queryRaw: mocks.query,
  lootReserveSetting: { findMany: mocks.find, upsert: mocks.upsert },
} }));
import { db } from '@/lib/db';
import { blockedItemIds, setItemBlocked } from './loot-blocks';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation((run) => run(db));
  mocks.query.mockResolvedValue([{ id: 't1' }]);
  mocks.find.mockResolvedValue([]);
});

describe('tier reserve settings', () => {
  it('defaults to no blocks, and reads only blocked items in the requested tier', async () => {
    expect(await blockedItemIds('t1')).toEqual(new Set());
    mocks.find.mockResolvedValue([{ itemId: 100 }]);
    expect(await blockedItemIds('t1')).toEqual(new Set([100]));
    expect(mocks.find).toHaveBeenLastCalledWith({ where: { templateId: 't1', blocked: true }, select: { itemId: true } });
  });

  it.each([true, false])('locks before setting blocked=%s, without removing reserves or other settings', async (blocked) => {
    await setItemBlocked('t1', 100, blocked);
    expect(mocks.query.mock.calls[0][0].join('?')).toBe('SELECT "id" FROM "RaidTemplate" WHERE "id" = ? FOR UPDATE');
    expect(mocks.query.mock.calls[0][1]).toBe('t1');
    expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(mocks.upsert.mock.invocationCallOrder[0]);
    expect(mocks.upsert).toHaveBeenCalledWith({ where: { templateId_itemId: { templateId: 't1', itemId: 100 } }, create: { templateId: 't1', itemId: 100, blocked }, update: { blocked } });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  });
});
