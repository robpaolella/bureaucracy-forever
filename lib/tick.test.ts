import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  raid: { findMany: vi.fn(), updateMany: vi.fn(), create: vi.fn() }, character: { findMany: vi.fn() },
  signup: { findMany: vi.fn() }, reserve: { findMany: vi.fn() },
  user: { findMany: vi.fn() }, raidSeries: { findMany: vi.fn() },
  application: { findMany: vi.fn(), updateMany: vi.fn() }, interview: { findMany: vi.fn(), updateMany: vi.fn() }, botRequest: { findUnique: vi.fn(), create: vi.fn() },
  enqueue: vi.fn(), enabled: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { ...mocks, $transaction: async (fn: (tx: typeof mocks) => unknown) => fn(mocks) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
vi.mock('@/lib/flags', async () => ({ ...(await vi.importActual<typeof import('@/lib/flags')>('@/lib/flags')), lootEnabled: mocks.enabled }));
import { runTick } from './tick';

const now = new Date('2026-10-16T17:00:00Z');
const raid = { id: 'r', status: 'LOCKED', startsAt: new Date('2026-10-16T20:00:00Z'), postedAt: new Date('2026-10-01'), remindReservesAt: null };
const signup = (id: string, characters = [{ id: 'char' }]) => ({ userId: id, response: 'ACCEPT', standing: 'BENCH', user: { discordId: `discord-${id}`, characters } });
let marked: boolean;
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
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
    expect(mocks.raid.updateMany).toHaveBeenCalledWith({ where: { id: 'r', remindReservesAt: null, reservesAllowed: true, status: { in: ['SCHEDULED', 'LOCKED'] }, startsAt: raid.startsAt }, data: { remindReservesAt: now } });
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
  it('bounds candidates by reserve time, posting, status, marker, the reserves switch and nonempty loot table', async () => {
    await runTick(now);
    expect(mocks.raid.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      status: { in: ['SCHEDULED', 'LOCKED'] }, postedAt: { not: null }, remindReservesAt: null, reservesAllowed: true,
      startsAt: { gt: new Date('2026-10-16T19:00:00Z'), lte: new Date('2026-10-16T21:00:00Z') },
      template: { lootBosses: { some: { entries: { some: {} } } } },
    } }));
  });

  it('bounds candidates by the start, not two hours before it, with OPEN_UNTIL_START on', async () => {
    vi.stubEnv('OPEN_UNTIL_START', 'true');
    await runTick(now);
    expect(mocks.raid.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      startsAt: { gt: now, lte: new Date('2026-10-16T19:00:00Z') },
    }) }));
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

describe('tick application reminders', () => {
  // Fri Oct 16 2026, 6 PM PDT: inside the evening window.
  const evening = new Date('2026-10-17T01:00:00Z');
  const created = new Date('2026-10-14T20:00:00Z');
  const app = (over: object = {}) => ({ id: 'app', status: 'PENDING', createdAt: created, reopenedAt: null, reminderTriedOn: null, reminderCount: 0, reminderActivityAt: null, reminderLastOn: null, notes: [], messages: [], interviews: [], ...over });
  const unclaimed = { status: 'PENDING', OR: [{ reminderTriedOn: null }, { reminderTriedOn: { not: '2026-10-16' } }] };
  const tickAt = (at: Date, rows: object[], won = 1) => {
    mocks.enabled.mockReturnValue(false);
    mocks.raid.findMany.mockResolvedValue([]);
    mocks.application.findMany.mockImplementation(async (args) => args.where.status === 'PENDING' ? rows : []);
    mocks.application.updateMany.mockResolvedValue({ count: won });
    mocks.botRequest.findUnique.mockResolvedValue({ body: { at: '2099-01-01T00:00:00Z' } });
    return runTick(at);
  };
  const nudges = () => mocks.enqueue.mock.calls.filter(([type]) => type === 'application.nudge');

  it("queues one keyed reminder for a due application and records today's try in the same transaction", async () => {
    expect((await tickAt(evening, [app()])).remindersQueued).toBe(1);
    expect(mocks.application.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: unclaimed }));
    expect(mocks.application.updateMany).toHaveBeenCalledExactlyOnceWith({ where: { id: 'app', ...unclaimed }, data: { reminderTriedOn: '2026-10-16', reminderKey: '2026-10-14T20:00:00.000Z@2026-10-16' } });
    expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('application.nudge', { applicationId: 'app', key: '2026-10-14T20:00:00.000Z@2026-10-16' }, mocks);
  });
  it("loads officers' relay messages, so a recent one keeps the reminder back", async () => {
    expect((await tickAt(evening, [app({ messages: [{ direction: 'TO_APPLICANT', createdAt: new Date('2026-10-16T12:00:00Z') }] })])).remindersQueued).toBe(0);
    const pendingQuery = mocks.application.findMany.mock.calls.find(([args]) => args.where.status === 'PENDING')![0];
    expect(pendingQuery.select.messages).toEqual({ where: { direction: 'TO_APPLICANT' }, select: { direction: true, createdAt: true } });
  });
  it('queues nothing when an overlapping tick already claimed the day', async () => {
    expect((await tickAt(evening, [app()], 0)).remindersQueued).toBe(0);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('queues nothing for an application that is not due', async () => {
    const notDue = [app({ reminderTriedOn: '2026-10-16' }), app({ createdAt: new Date('2026-10-16T12:00:00Z') }), app({ interviews: [{ attempt: 1, status: 'AWAITING_TIMES', requestedAt: created, timesUpdatedAt: null, proposedAt: null, bookedAt: null, bookedStart: null, endedAt: null }] })];
    expect((await tickAt(evening, notDue)).remindersQueued).toBe(0);
    // Before 5 PM Pacific nothing is due at all.
    expect((await tickAt(new Date('2026-10-16T23:59:00Z'), [app()])).remindersQueued).toBe(0);
    expect(mocks.application.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
  it('no longer sends the old once-only nudge', async () => {
    // Pending for two days, never nudged, empty counters: before 5 PM nothing is queued, and in
    // the window the only nudge carries a key.
    const legacy = app({ nudgedAt: null });
    expect(await tickAt(new Date('2026-10-16T17:00:00Z'), [legacy])).not.toHaveProperty('nudged');
    expect(nudges()).toEqual([]);
    await tickAt(evening, [legacy]);
    expect(nudges()).toHaveLength(1);
    expect(nudges().every(([, payload]) => typeof (payload as { key?: unknown }).key === 'string')).toBe(true);
  });
});

describe('tick generation', () => {
  it.each([
    ['an old-shape', { tank: 2, healer: 8, melee: 11, ranged: 14 }],
    ['a new-shape', { tank: 2, healer: 8, dps: 25 }],
  ])('stores exactly three requirement keys on each raid generated from %s template', async (_shape, requirements) => {
    mocks.raidSeries.findMany.mockResolvedValue([{ id: 's', templateId: 't', weekday: 3, startTime: '20:00', horizonWeeks: 1, lockMinutesBefore: 120, durationMin: 180, notes: null, skippedDates: [], raids: [], template: { name: 'Onyxia', requirements } }]);
    mocks.character.findMany.mockResolvedValue([]);
    mocks.raid.create.mockResolvedValue({});
    await runTick(now);
    expect(mocks.raid.create).toHaveBeenCalled();
    for (const [{ data }] of mocks.raid.create.mock.calls) expect(data.requirements).toStrictEqual({ tank: 2, healer: 8, dps: 25 });
  });
});

describe('tick interview digest', () => {
  const at = (iso: string) => new Date(iso);
  const booked = (id: string, start: string, bookedAt: string, over: object = {}) => ({
    id, applicationId: `app-${id}`, status: 'BOOKED', bookedStart: at(start), bookedAt: at(bookedAt), bookedById: 'u1',
    application: { character: `Char ${id}`, discordThreadId: id === 'a' ? 'thread-a' : null }, ...over,
  });
  const handled = new Set<string>();
  let rows: ReturnType<typeof booked>[];
  const run = async (iso: string) => {
    const counts = await runTick(at(iso));
    return counts.interviewDigests;
  };
  const digestJobs = () => mocks.enqueue.mock.calls.filter((c) => c[0] === 'interview.digest');
  beforeEach(() => {
    handled.clear();
    rows = [];
    mocks.raid.findMany.mockResolvedValue([]);
    mocks.botRequest.findUnique.mockImplementation(async ({ where }) => (where.key === 'tick:reconcile' ? { body: { at: '2099-01-01T00:00:00Z' } } : handled.has(where.key) ? { key: where.key } : null));
    mocks.botRequest.create.mockImplementation(async ({ data }) => {
      if (handled.has(data.key)) throw Object.assign(new Error('unique'), { code: 'P2002' });
      handled.add(data.key);
    });
    mocks.user.findMany.mockImplementation(async (args) => (args.where.id ? [{ id: 'u1', discordId: 'd1', discordName: 'Officer One' }] : []));
    mocks.interview.findMany.mockImplementation(async (args) => {
      if (args.where.activeKey) return [];
      const w = args.where;
      return rows.filter((r) => r.status === w.status && r.bookedStart > w.bookedStart.gt && r.bookedStart < w.bookedStart.lt && r.bookedAt < w.bookedAt.lt)
        .sort((x, y) => x.bookedStart.getTime() - y.bookedStart.getTime());
    });
  });

  it('enqueues nothing before 08:00 Pacific', async () => {
    rows = [booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z')];
    expect(await run('2026-10-16T14:59:00Z')).toBe(0);
    expect(mocks.botRequest.create).not.toHaveBeenCalled();
  });
  it('enqueues one digest in start order on the first tick at 08:00, and none on later ticks', async () => {
    rows = [booked('b', '2026-10-17T05:00:00Z', '2026-10-10T00:00:00Z'), booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z')];
    expect(await run('2026-10-16T15:00:00Z')).toBe(1);
    expect(await run('2026-10-16T15:01:00Z')).toBe(0);
    expect(digestJobs()).toEqual([['interview.digest', {
      date: '2026-10-16',
      interviews: [
        { interviewId: 'a', applicationId: 'app-a', startsAt: '2026-10-16T20:00:00.000Z', characterName: 'Char a', bookedBy: { discordId: 'd1', name: 'Officer One' }, threadId: 'thread-a' },
        { interviewId: 'b', applicationId: 'app-b', startsAt: '2026-10-17T05:00:00.000Z', characterName: 'Char b', bookedBy: { discordId: 'd1', name: 'Officer One' }, threadId: null },
      ],
    }, mocks]]);
    expect(mocks.botRequest.create).toHaveBeenCalledWith({ data: expect.objectContaining({ key: 'tick:interview-digest:2026-10-16' }) });
  });
  it('leaves out interviews booked after 08:00, on another Pacific date, or already started', async () => {
    rows = [
      booked('late', '2026-10-16T20:00:00Z', '2026-10-16T15:00:01Z'),
      booked('tomorrow', '2026-10-17T07:00:00Z', '2026-10-10T00:00:00Z'),
      booked('started', '2026-10-16T16:00:00Z', '2026-10-10T00:00:00Z'),
      booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z'),
    ];
    expect(await run('2026-10-16T17:00:00Z')).toBe(1);
    expect(digestJobs()[0][1].interviews.map((i: { interviewId: string }) => i.interviewId)).toEqual(['a']);
  });
  it('lists a missing or absent booker as null', async () => {
    rows = [booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z', { bookedById: null })];
    await run('2026-10-16T15:00:00Z');
    expect(digestJobs()[0][1].interviews[0].bookedBy).toBeNull();
  });
  it('records the date and enqueues nothing when no interview qualifies', async () => {
    expect(await run('2026-10-16T15:00:00Z')).toBe(0);
    expect(handled.has('tick:interview-digest:2026-10-16')).toBe(true);
    rows = [booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z')];
    expect(await run('2026-10-16T16:00:00Z')).toBe(0);
    expect(digestJobs()).toHaveLength(0);
  });
  it('lists only the interviews still ahead when the bot returns at 11:00', async () => {
    rows = [booked('early', '2026-10-16T17:00:00Z', '2026-10-10T00:00:00Z'), booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z')];
    expect(await run('2026-10-16T18:00:00Z')).toBe(1);
    expect(digestJobs()[0][1].interviews.map((i: { interviewId: string }) => i.interviewId)).toEqual(['a']);
  });
  it('enqueues nothing when a concurrent tick already recorded the date', async () => {
    mocks.botRequest.findUnique.mockImplementation(async ({ where }) => (where.key === 'tick:reconcile' ? { body: { at: '2099-01-01T00:00:00Z' } } : null));
    handled.add('tick:interview-digest:2026-10-16');
    rows = [booked('a', '2026-10-16T20:00:00Z', '2026-10-10T00:00:00Z')];
    expect(await run('2026-10-16T15:00:00Z')).toBe(0);
    expect(digestJobs()).toHaveLength(0);
  });
  it('rethrows other errors from the transaction', async () => {
    mocks.botRequest.create.mockRejectedValue(new Error('boom'));
    await expect(run('2026-10-16T15:00:00Z')).rejects.toThrow('boom');
  });
  it('handles the spring-forward day (23 hours long)', async () => {
    rows = [booked('in', '2026-03-09T06:59:00Z', '2026-03-01T00:00:00Z'), booked('out', '2026-03-09T07:00:00Z', '2026-03-01T00:00:00Z')];
    expect(await run('2026-03-08T14:59:00Z')).toBe(0);
    expect(await run('2026-03-08T15:00:00Z')).toBe(1);
    expect(digestJobs()[0][1].interviews.map((i: { interviewId: string }) => i.interviewId)).toEqual(['in']);
  });
  it('handles the fall-back day (25 hours long)', async () => {
    rows = [booked('in', '2026-11-02T07:59:00Z', '2026-10-25T00:00:00Z'), booked('out', '2026-11-02T08:00:00Z', '2026-10-25T00:00:00Z')];
    expect(await run('2026-11-01T15:59:00Z')).toBe(0);
    expect(await run('2026-11-01T16:00:00Z')).toBe(1);
    expect(digestJobs()[0][1].interviews.map((i: { interviewId: string }) => i.interviewId)).toEqual(['in']);
  });
});
