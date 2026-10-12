import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => {
  const tx = { raid: { findMany: vi.fn(), update: vi.fn() }, $executeRaw: vi.fn() };
  return {
    tx,
    seriesFind: vi.fn(), seriesUpdate: vi.fn(), templateFind: vi.fn(),
    raidFindMany: vi.fn(), raidUpdate: vi.fn(),
    transaction: vi.fn(), lock: vi.fn(), enqueue: vi.fn(), generate: vi.fn(),
  };
});

vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/db', () => ({ db: {
  raidSeries: { findUnique: mocks.seriesFind, update: mocks.seriesUpdate },
  raidTemplate: { findUnique: mocks.templateFind },
  raid: { findMany: mocks.raidFindMany, update: mocks.raidUpdate },
  $transaction: mocks.transaction,
} }));
vi.mock('@/lib/loot-blocks', () => ({ lockReserveTier: mocks.lock }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
vi.mock('@/lib/tick', () => ({ generateInstances: mocks.generate, rosterUserIds: async () => [] }));

import { PATCH } from './route';

const SERIES = { id: 's1', templateId: 'tier-b', weekday: 4, startTime: '20:00', durationMin: 180, notes: null, postAheadDays: 14, lockMinutesBefore: 120, horizonWeeks: 4, active: true, skippedDates: [], createdById: 'u' };
const FUTURE = new Date('2099-03-04T12:00:00Z');
const PAST = new Date('2001-03-04T12:00:00Z');
const raid = (id: string, templateId: string | null, extra: Record<string, unknown> = {}) => ({ id, startsAt: FUTURE, discordThreadId: null, templateId, ...extra });
const patch = () => PATCH(
  new Request('https://example.test/api/raid-series/s1', { method: 'PATCH', body: JSON.stringify({}) }),
  { params: Promise.resolve({ id: 's1' }) },
);
const p2002 = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

describe('PATCH /api/raid-series/:id moving future raids', () => {
  beforeEach(() => {
    for (const fn of [mocks.tx.raid.findMany, mocks.tx.raid.update, mocks.tx.$executeRaw, mocks.raidFindMany, mocks.raidUpdate, mocks.lock, mocks.enqueue]) fn.mockReset();
    mocks.seriesFind.mockReset().mockResolvedValue(SERIES);
    mocks.seriesUpdate.mockReset();
    mocks.templateFind.mockReset().mockResolvedValue({ id: 'tier-b', name: 'Tier B', requirements: { tank: 4, healer: 10, melee: 12, ranged: 14 }, active: true });
    mocks.generate.mockReset().mockResolvedValue(0);
    mocks.transaction.mockReset().mockImplementation(async (fn: (tx: typeof mocks.tx) => unknown) => fn(mocks.tx));
  });

  it('moves raids that are already on the tier without a transaction or a tier lock', async () => {
    mocks.raidFindMany.mockResolvedValue([raid('r1', 'tier-b', { discordThreadId: 't' }), raid('r2', 'tier-b')]);
    const body = await (await patch()).json();
    expect(body).toMatchObject({ moved: 2 });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.lock).not.toHaveBeenCalled();
    expect(mocks.raidUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });

  it('skips a raid that would land in the past or collide, and does not count it', async () => {
    mocks.raidFindMany.mockResolvedValue([raid('past', 'tier-b', { startsAt: PAST }), raid('clash', 'tier-b', { discordThreadId: 't' }), raid('ok', 'tier-b')]);
    mocks.raidUpdate.mockImplementation(async ({ where }: { where: { id: string } }) => { if (where.id === 'clash') throw p2002(); });
    expect(await (await patch()).json()).toMatchObject({ moved: 1 });
    expect(mocks.raidUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('rethrows an error that is not a collision', async () => {
    mocks.raidFindMany.mockResolvedValue([raid('r1', 'tier-b')]);
    mocks.raidUpdate.mockRejectedValue(new Error('boom'));
    await expect(patch()).rejects.toThrow('boom');
  });

  describe('when the tier changes', () => {
    it('locks the new tier and each distinct old tier in id order, then moves the raids', async () => {
      const raids = [raid('r1', 'tier-z'), raid('r2', 'tier-a'), raid('r3', 'tier-z'), raid('r4', null), raid('r5', 'tier-b')];
      mocks.raidFindMany.mockResolvedValue(raids);
      mocks.tx.raid.findMany.mockResolvedValue(raids);
      expect(await (await patch()).json()).toMatchObject({ moved: 5 });
      expect(mocks.lock.mock.calls.map((call) => call[1])).toEqual(['tier-a', 'tier-b', 'tier-z']);
      expect(mocks.tx.raid.update).toHaveBeenCalledTimes(5);
      expect(mocks.raidUpdate).not.toHaveBeenCalled();
    });

    it('locks only the new tier for raids with no tier', async () => {
      mocks.raidFindMany.mockResolvedValue([raid('r1', null)]);
      mocks.tx.raid.findMany.mockResolvedValue([raid('r1', null)]);
      await patch();
      expect(mocks.lock.mock.calls.map((call) => call[1])).toEqual(['tier-b']);
    });

    it('skips past and colliding raids, rolling a collision back to its savepoint, and queues updates only for raids that moved', async () => {
      const raids = [raid('past', 'tier-a', { startsAt: PAST, discordThreadId: 't' }), raid('clash', 'tier-a', { discordThreadId: 't' }), raid('ok', 'tier-a', { discordThreadId: 't' })];
      mocks.raidFindMany.mockResolvedValue(raids);
      mocks.tx.raid.findMany.mockResolvedValue(raids);
      mocks.tx.raid.update.mockImplementation(async ({ where }: { where: { id: string } }) => { if (where.id === 'clash') throw p2002(); });
      expect(await (await patch()).json()).toMatchObject({ moved: 1 });
      expect(mocks.tx.raid.update).toHaveBeenCalledTimes(2);
      expect(mocks.enqueue).toHaveBeenCalledTimes(1);
      expect(mocks.enqueue).toHaveBeenCalledWith('raid.update', { raidId: 'ok' }, mocks.tx);
      const sql = mocks.tx.$executeRaw.mock.calls.map((call) => (call[0] as string[]).join(''));
      expect(sql).toContain('ROLLBACK TO SAVEPOINT series_move');
    });

    it('locks again when the raids read under the lock sit on a tier it did not hold', async () => {
      mocks.raidFindMany.mockResolvedValue([raid('r1', 'tier-a')]);
      mocks.tx.raid.findMany
        .mockResolvedValueOnce([raid('r1', 'tier-a'), raid('r2', 'tier-c')])
        .mockResolvedValueOnce([raid('r1', 'tier-a'), raid('r2', 'tier-c')]);
      expect(await (await patch()).json()).toMatchObject({ moved: 2 });
      expect(mocks.transaction).toHaveBeenCalledTimes(2);
      expect(mocks.lock.mock.calls.map((call) => call[1])).toEqual(['tier-a', 'tier-b', 'tier-a', 'tier-b', 'tier-c']);
      expect(mocks.tx.raid.update).toHaveBeenCalledTimes(2);
    });
  });
});
