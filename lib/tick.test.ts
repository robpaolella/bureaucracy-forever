import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  raid: { findMany: vi.fn(), updateMany: vi.fn() },
  signup: { findMany: vi.fn() }, reserve: { findMany: vi.fn() },
  user: { findMany: vi.fn() }, raidSeries: { findMany: vi.fn() },
  application: { findMany: vi.fn() }, interview: { findMany: vi.fn(), updateMany: vi.fn() }, botRequest: { findUnique: vi.fn() },
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
  mocks.interview.findMany.mockResolvedValue([]);
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

describe('tick interview steps', () => {
  const start = new Date('2026-10-16T20:00:00Z');
  const row = (over: object = {}) => ({ id: 'i', applicationId: 'a', status: 'BOOKED', requestedAt: new Date('2026-10-01T00:00:00Z'), proposedStart: null, bookedStart: start, remindedAt: null, headsUpAt: null, joinedNotifiedAt: null, ...over });
  const tickAt = (iso: string, rows: object[]) => {
    mocks.interview.findMany.mockResolvedValue(rows);
    mocks.interview.updateMany.mockResolvedValue({ count: 1 });
    mocks.raid.findMany.mockResolvedValue([]);
    mocks.botRequest.findUnique.mockResolvedValue({ body: { at: '2099-01-01T00:00:00Z' } });
    return runTick(new Date(iso));
  };
  const zero = { interviewsReminded: 0, interviewsExpired: 0, interviewsHeadsUp: 0, interviewsLapsed: 0, interviewsDone: 0 };

  it('reminds at start − 2 min (late after a restart), conditionally, and not at start + 1 min', async () => {
    const counts = await tickAt('2026-10-16T19:58:00Z', [row()]);
    expect(counts).toMatchObject({ ...zero, interviewsReminded: 1 });
    expect(mocks.interview.updateMany).toHaveBeenCalledWith({ where: { id: 'i', status: 'BOOKED', remindedAt: null, bookedStart: start }, data: { remindedAt: new Date('2026-10-16T19:58:00Z') } });
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('interview.remind', { applicationId: 'a', interviewId: 'i', startsAt: start.toISOString() }, mocks);
    vi.clearAllMocks();
    expect(await tickAt('2026-10-16T20:01:00Z', [row()])).toMatchObject(zero);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('sends nothing when the conditional update loses to another tick', async () => {
    mocks.interview.findMany.mockResolvedValue([row()]);
    mocks.interview.updateMany.mockResolvedValue({ count: 0 });
    mocks.raid.findMany.mockResolvedValue([]);
    mocks.botRequest.findUnique.mockResolvedValue({ body: { at: '2099-01-01T00:00:00Z' } });
    expect(await runTick(new Date('2026-10-16T19:58:00Z'))).toMatchObject(zero);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('expires at 7 days with an ended job and no heads-up', async () => {
    const counts = await tickAt('2026-10-08T00:00:00Z', [row({ status: 'AWAITING_TIMES', bookedStart: null })]);
    expect(counts).toMatchObject({ ...zero, interviewsExpired: 1 });
    expect(mocks.interview.updateMany).toHaveBeenCalledWith({ where: { id: 'i', status: 'AWAITING_TIMES' }, data: { status: 'NO_TIME', endReason: 'EXPIRED', activeKey: null, endedAt: new Date('2026-10-08T00:00:00Z') } });
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('interview.ended', { applicationId: 'a', interviewId: 'i', outcome: 'expired' }, mocks);
  });
  it('gives the heads-up at 3 days, not before', async () => {
    expect(await tickAt('2026-10-03T23:59:00Z', [row({ status: 'AWAITING_TIMES', bookedStart: null })])).toMatchObject(zero);
    expect(await tickAt('2026-10-04T00:00:00Z', [row({ status: 'AWAITING_TIMES', bookedStart: null })])).toMatchObject({ ...zero, interviewsHeadsUp: 1 });
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('interview.headsup', { applicationId: 'a', interviewId: 'i' }, mocks);
  });
  it('lapses a proposal at its start', async () => {
    const proposed = row({ status: 'PROPOSED', bookedStart: null, proposedStart: start });
    expect(await tickAt('2026-10-16T19:59:00Z', [proposed])).toMatchObject(zero);
    expect(await tickAt('2026-10-16T20:00:00Z', [proposed])).toMatchObject({ ...zero, interviewsLapsed: 1 });
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('interview.ended', { applicationId: 'a', interviewId: 'i', outcome: 'lapsed' }, mocks);
  });
  it('finishes a booking an hour after its start with no job', async () => {
    expect(await tickAt('2026-10-16T20:59:00Z', [row({ remindedAt: start })])).toMatchObject(zero);
    expect(await tickAt('2026-10-16T21:00:00Z', [row({ remindedAt: start })])).toMatchObject({ ...zero, interviewsDone: 1 });
    expect(mocks.interview.updateMany).toHaveBeenLastCalledWith({ where: { id: 'i', status: 'BOOKED', bookedStart: start }, data: { status: 'DONE', activeKey: null, endedAt: new Date('2026-10-16T21:00:00Z') } });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('leaves already-handled interviews alone', async () => {
    const counts = await tickAt('2026-10-16T19:58:00Z', [row({ remindedAt: new Date('2026-10-16T19:55:00Z') })]);
    expect(counts).toMatchObject(zero);
    expect(mocks.interview.updateMany).not.toHaveBeenCalled();
  });
});
