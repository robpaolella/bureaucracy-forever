import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  raid: { findMany: vi.fn(), updateMany: vi.fn() },
  signup: { findMany: vi.fn() }, reserve: { findMany: vi.fn() },
  user: { findMany: vi.fn() }, raidSeries: { findMany: vi.fn() },
  application: { findMany: vi.fn() }, botRequest: { findUnique: vi.fn() },
  enqueue: vi.fn(), enabled: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
vi.mock('@/lib/flags', () => ({ lootEnabled: mocks.enabled }));
import { runTick } from './tick';

const now = new Date('2026-10-16T17:00:00Z');
const raid = { id: 'r', status: 'LOCKED', startsAt: new Date('2026-10-16T20:00:00Z'), postedAt: new Date('2026-10-01'), remindReservesAt: null };
const signup = (id: string, characters = [{ id: 'char' }]) => ({ userId: id, response: 'ACCEPT', standing: 'BENCH', user: { discordId: `discord-${id}`, characters } });
let marked: boolean;
beforeEach(() => {
  vi.resetAllMocks();
  marked = false;
  mocks.enabled.mockReturnValue(true);
  mocks.user.findMany.mockResolvedValue([]);
  mocks.raidSeries.findMany.mockResolvedValue([]);
  mocks.application.findMany.mockResolvedValue([]);
  mocks.botRequest.findUnique.mockResolvedValue({ body: { at: now.toISOString() } });
  mocks.raid.findMany.mockImplementation(async (args) => args.where.remindReservesAt === null && !marked ? [raid] : []);
  mocks.raid.updateMany.mockImplementation(async () => {
    if (marked) return { count: 0 };
    marked = true;
    return { count: 1 };
  });
  mocks.signup.findMany.mockResolvedValue([signup('a'), signup('b')]);
  mocks.reserve.findMany.mockResolvedValue([{ userId: 'b', kind: 'HR' }, { userId: 'b', kind: 'SR' }]);
});
describe('tick reserve reminders', () => {
  it('queues the expected recipients once across repeated ticks', async () => {
    expect((await runTick(now)).reservesReminded).toBe(1);
    expect((await runTick(now)).reservesReminded).toBe(0);
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('raid.reserves.remind', { raidId: 'r', discordIds: ['discord-a'], reservesLockAt: '2026-10-16T18:00:00.000Z' }, mocks);
    expect(mocks.raid.updateMany).toHaveBeenCalledWith({ where: { id: 'r', remindReservesAt: null, status: { in: ['SCHEDULED', 'LOCKED'] }, startsAt: raid.startsAt }, data: { remindReservesAt: now } });
  });
  it('conditionally claims stale candidates from overlapping ticks', async () => {
    mocks.raid.findMany.mockImplementation(async (args) => args.where.remindReservesAt === null ? [raid] : []);
    const results = await Promise.all([runTick(now), runTick(now)]);
    expect(results.reduce((n, r) => n + r.reservesReminded, 0)).toBe(1);
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
  });
  it.each(['complete', 'empty', 'noCharacter'])('marks %s without enqueueing or rechecking', async (scenario) => {
    mocks.signup.findMany.mockResolvedValue(scenario === 'complete' ? [signup('b')] : scenario === 'empty' ? [] : [signup('a', [])]);
    expect((await runTick(now)).reservesReminded).toBe(0);
    await runTick(now);
    expect(marked).toBe(true);
    expect(mocks.enqueue).not.toHaveBeenCalled();
    expect(mocks.signup.findMany).toHaveBeenCalledTimes(1);
  });
  it('does not query reminder candidates when loot is disabled', async () => {
    mocks.enabled.mockReturnValue(false);
    await runTick(now);
    expect(mocks.raid.updateMany).not.toHaveBeenCalled();
    expect(mocks.raid.findMany.mock.calls.some(([args]) => args.where.remindReservesAt === null)).toBe(false);
  });
  it('bounds candidates by reserve time, posting, status, marker and nonempty loot table', async () => {
    await runTick(now);
    expect(mocks.raid.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      status: { in: ['SCHEDULED', 'LOCKED'] }, postedAt: { not: null }, remindReservesAt: null,
      startsAt: { gt: new Date('2026-10-16T19:00:00Z'), lte: new Date('2026-10-16T21:00:00Z') },
      template: { lootBosses: { some: { entries: { some: {} } } } },
    } }));
  });
});
