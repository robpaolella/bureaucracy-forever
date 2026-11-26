import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArmoryClient } from './armory';

const mocks = vi.hoisted(() => ({ updateMany: vi.fn(), findMany: vi.fn(), lookup: vi.fn(), settings: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { character: { updateMany: mocks.updateMany, findMany: mocks.findMany } } }));
vi.mock('@/lib/armory-store', () => ({ lookupAndStoreLevel: mocks.lookup }));
vi.mock('@/lib/armory', () => ({ armorySettings: mocks.settings }));
import { refreshCharacterLevels, REFRESH_BATCH } from './character-level-refresh';

const now = new Date('2026-11-25T12:00:00Z');
const day = 24 * 60 * 60 * 1000;
const client = {} as ArmoryClient;
const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.settings.mockReturnValue({ clientId: 'id', clientSecret: 'secret' });
  mocks.updateMany.mockResolvedValue({ count: 0 });
  mocks.findMany.mockResolvedValue([]);
});

describe('refreshCharacterLevels', () => {
  it('clears levels last confirmed over 30 days ago', async () => {
    await refreshCharacterLevels(now, client);
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { level: { not: null }, levelCheckedAt: { lt: new Date(now.getTime() - 30 * day) } },
      data: { level: null, levelCheckedAt: null },
    });
  });

  it('selects never-succeeded, 25-day-old, and stale low or unknown levels, oldest attempt first', async () => {
    await refreshCharacterLevels(now, client);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { levelCheckedAt: null },
          { levelCheckedAt: { lt: new Date(now.getTime() - 25 * day) } },
          { OR: [{ level: null }, { level: { lt: 60 } }], levelCheckedAt: { lt: new Date(now.getTime() - day) } },
        ],
      },
      orderBy: [{ levelAttemptedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      take: REFRESH_BATCH,
      select: { id: true },
    });
  });

  it('looks up the due characters in order and counts found and not-found', async () => {
    mocks.findMany.mockResolvedValue(ids(3));
    mocks.lookup.mockResolvedValueOnce('found').mockResolvedValueOnce('not-found').mockResolvedValueOnce('gone');
    expect(await refreshCharacterLevels(now, client)).toBe(2);
    expect(mocks.lookup.mock.calls.map((c) => c[0])).toEqual(['c0', 'c1', 'c2']);
  });

  it('stops the step at the first failed lookup (429, 5xx), keeping what it refreshed', async () => {
    mocks.findMany.mockResolvedValue(ids(5));
    mocks.lookup.mockResolvedValueOnce('found').mockResolvedValueOnce('failed');
    expect(await refreshCharacterLevels(now, client)).toBe(1);
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
  });

  it('asks for no more than the batch size', async () => {
    expect(REFRESH_BATCH).toBe(5);
    await refreshCharacterLevels(now, client);
    expect(mocks.findMany.mock.calls[0][0].take).toBe(5);
  });

  it('a failing character does not starve others: its attempt time sends it to the back', async () => {
    // The store sets levelAttemptedAt on failure; the next tick's queue then lists it last.
    mocks.findMany.mockResolvedValue([{ id: 'ok' }]);
    mocks.lookup.mockResolvedValue('found');
    expect(await refreshCharacterLevels(now, client)).toBe(1);
    expect(mocks.findMany.mock.calls[0][0].orderBy[0]).toEqual({ levelAttemptedAt: { sort: 'asc', nulls: 'first' } });
  });

  it('without Blizzard settings it still clears expired levels but looks nothing up', async () => {
    mocks.settings.mockReturnValue(null);
    expect(await refreshCharacterLevels(now)).toBe(0);
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
});
