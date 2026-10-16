import { beforeEach, describe, expect, it, vi } from 'vitest';

// A small in-memory stand-in for the tables these functions touch, matching only the
// filters they use, so each test reads as a state change and its jobs.
type Row = Record<string, unknown> & { id: string; applicationId: string };
const KnownError = vi.hoisted(() => class extends Error { code = 'P2002'; });
const store = vi.hoisted(() => ({ apps: [] as Record<string, unknown>[], rows: [] as Row[], users: [] as Record<string, unknown>[], jobs: [] as [string, Record<string, unknown>][] }));
const match = (row: Row, where: Record<string, unknown> = {}): boolean => Object.entries(where).every(([key, want]) => {
  if (key === 'application') {
    const app = store.apps.find((a) => a.id === row.applicationId)!;
    return Object.entries(want as object).every(([k, v]) => app[k] === v);
  }
  const have = row[key];
  if (want && typeof want === 'object' && 'in' in want) return (want.in as unknown[]).includes(have);
  if (want && typeof want === 'object' && 'not' in want) return have !== want.not;
  return have === want;
});
const withApp = (row: Row | undefined) => row && { ...row, application: store.apps.find((a) => a.id === row.applicationId) };
const sortBy = (rows: Row[], orderBy?: Record<string, 'asc' | 'desc'>) => {
  if (!orderBy) return rows;
  const [[key, dir]] = Object.entries(orderBy);
  const value = (r: Row) => (r[key] instanceof Date ? (r[key] as Date).getTime() : (r[key] as number));
  return [...rows].sort((a, b) => (dir === 'desc' ? value(b) - value(a) : value(a) - value(b)));
};
const fake = vi.hoisted(() => ({
  interview: {
    findUnique: async ({ where }: { where: { id: string } }) => withApp(store.rows.find((r) => r.id === where.id)) ?? null,
    findFirst: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) => withApp(sortBy(store.rows.filter((r) => match(r, where)), orderBy)[0]) ?? null,
    findMany: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> }) => sortBy(store.rows.filter((r) => match(r, where)), orderBy),
    create: async ({ data }: { data: Record<string, unknown> & { applicationId: string } }) => {
      if (store.rows.some((r) => data.activeKey && r.activeKey === data.activeKey)) throw new KnownError('unique');
      const row = { id: `i${store.rows.length + 1}`, status: 'AWAITING_TIMES', endReason: null, timeZone: null, slots: [], timesRevision: 0, timesSubmittedAt: null, timesUpdatedAt: null, proposedStart: null, proposedById: null, bookedStart: null, bookedById: null, endedAt: null, endedById: null, requestDmId: null, timesMessageId: null, proposalMessageId: null, proposalDmId: null, bookedMessageId: null, ...data };
      store.rows.push(row);
      return withApp(row);
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hits = store.rows.filter((r) => match(r, where));
      hits.forEach((r) => Object.assign(r, data));
      return { count: hits.length };
    },
  },
  user: {
    findMany: async ({ where }: { where: { id: { in: string[] } } }) => store.users.filter((u) => where.id.in.includes(u.id as string)),
    findUnique: async ({ where }: { where: { discordId: string } }) => store.users.find((u) => u.discordId === where.discordId) ?? null,
  },
  $queryRaw: async (_sql: TemplateStringsArray, id: string) => store.apps.filter((a) => a.id === id),
}));
vi.mock('@/lib/db', () => ({ db: { ...fake, $transaction: async (fn: (tx: typeof fake) => unknown) => fn(fake) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: async (type: string, payload: Record<string, unknown>) => { store.jobs.push([type, payload]); return 'job'; } }));
vi.mock('@/lib/generated/prisma/client', () => ({ Prisma: { PrismaClientKnownRequestError: KnownError } }));
import { answerProposal, applicantInterview, bookInterview, cancelInterview, closeActiveInterview, getInterview, latestInterview, proposeTime, startInterview, submitTimes } from './interviews';

const now = new Date('2026-10-16T17:00:00Z'); // 10:00 AM guild time
const pick = (iso: string) => new Date(iso).toISOString();
const SLOT = pick('2026-10-17T02:00:00Z'); // 7:00 PM guild time, the 16th
const SLOT2 = pick('2026-10-17T02:30:00Z');
const interview = (data: Partial<Row> = {}) => {
  const row = { id: `i${store.rows.length + 1}`, applicationId: 'app', attempt: store.rows.length + 1, status: 'AWAITING_TIMES', endReason: null, activeKey: null as string | null, requestedById: 'officer', requestedAt: now, windowStart: new Date('2026-10-16T19:00:00Z'), windowEnd: new Date('2026-10-23T17:00:00Z'), timeZone: null, slots: [] as Date[], timesRevision: 0, timesSubmittedAt: null, timesUpdatedAt: null, proposedStart: null, proposedById: null, bookedStart: null, bookedById: null, endedAt: null, endedById: null, requestDmId: null, timesMessageId: null, proposalMessageId: null, proposalDmId: null, bookedMessageId: null, ...data };
  if (['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED'].includes(row.status as string) && data.activeKey === undefined) row.activeKey = row.applicationId;
  store.rows.push(row);
  return row;
};
const jobTypes = () => store.jobs.map(([type]) => type);

beforeEach(() => {
  store.apps = [
    { id: 'app', status: 'PENDING', character: 'Thrall', discordId: 'applicant', discordThreadId: 'thread' },
    { id: 'app2', status: 'PENDING', character: 'Jaina', discordId: 'applicant', discordThreadId: null },
  ];
  store.rows = [];
  store.users = [{ id: 'officer', discordId: 'officer-discord', discordName: 'Robert' }];
  store.jobs = [];
});

describe('starting an interview', () => {
  it('creates the first attempt with its window and asks for times', async () => {
    const result = await startInterview('app', { userId: 'officer' }, { now });
    expect(result).toMatchObject({ ok: true, interview: { attempt: 1, status: 'AWAITING_TIMES', applicant: { discordId: 'applicant', characterName: 'Thrall' }, threadId: 'thread', requestedBy: { discordId: 'officer-discord', name: 'Robert' }, pageUrl: 'https://www.bureauguild.com/apply/interview', slots: [] } });
    expect(store.rows[0]).toMatchObject({ activeKey: 'app', requestedAt: now, windowStart: new Date('2026-10-16T19:00:00Z'), windowEnd: new Date('2026-10-23T17:00:00Z') });
    expect(store.jobs).toEqual([['interview.request', { applicationId: 'app', interviewId: 'i1' }]]);
  });

  it.each(['ACCEPTED', 'DECLINED'])('refuses a %s application', async (status) => {
    store.apps[0].status = status;
    expect(await startInterview('app', { userId: 'officer' }, { now })).toMatchObject({ ok: false, status: 409, reason: 'not_pending' });
    expect(store.rows).toEqual([]);
    expect(store.jobs).toEqual([]);
  });

  it('refuses an unknown application', async () => {
    expect(await startInterview('nope', { userId: 'officer' })).toMatchObject({ ok: false, status: 404 });
  });

  it('refuses while one is active and returns it', async () => {
    interview({ status: 'BOOKED' });
    expect(await startInterview('app', { userId: 'officer' }, { now })).toMatchObject({ ok: false, status: 409, reason: 'already_active', interview: { id: 'i1', status: 'BOOKED' } });
    expect(store.rows).toHaveLength(1);
    expect(store.jobs).toEqual([]);
  });

  it('reports a start that loses the unique race as already active', async () => {
    const original = fake.interview.findMany;
    // The competing start commits between this one's read and its insert.
    fake.interview.findMany = async () => { interview({ status: 'AWAITING_TIMES' }); return []; };
    try {
      expect(await startInterview('app', { userId: 'officer' }, { now })).toMatchObject({ ok: false, reason: 'already_active', interview: { id: 'i1' } });
    } finally {
      fake.interview.findMany = original;
    }
    expect(store.rows).toHaveLength(1);
  });

  it('asks to confirm a second interview after a DONE one, then tags the application', async () => {
    interview({ status: 'DONE', bookedStart: new Date('2026-10-10T02:00:00Z') });
    expect(await startInterview('app', { userId: 'officer' }, { now })).toMatchObject({ ok: false, status: 409, reason: 'second_not_confirmed', earlierDate: '2026-10-10T02:00:00.000Z' });
    expect(store.rows).toHaveLength(1);
    const result = await startInterview('app', { userId: 'officer' }, { now, confirmSecond: true });
    expect(result).toMatchObject({ ok: true, interview: { attempt: 2 } });
    expect(jobTypes()).toEqual(['interview.request', 'application.update']);
  });

  it.each(['CANCELLED', 'NO_TIME', 'CLOSED'])('needs no confirmation after a %s attempt and leaves the tag alone', async (status) => {
    interview({ status, endReason: status === 'NO_TIME' ? 'EXPIRED' : null });
    expect(await startInterview('app', { userId: 'officer' }, { now })).toMatchObject({ ok: true, interview: { attempt: 2 } });
    expect(jobTypes()).toEqual(['interview.request']);
  });
});

describe('the applicant submitting times', () => {
  it('moves to TIMES_RECEIVED, stores sorted unique slots and the zone, and enqueues the times', async () => {
    interview();
    const result = await submitTimes('i1', 'applicant', [SLOT2, SLOT, SLOT], 'Europe/London', now);
    expect(result).toMatchObject({ ok: true, interview: { status: 'TIMES_RECEIVED', timesRevision: 1, timeZone: 'Europe/London', slots: [SLOT, SLOT2] } });
    expect(store.rows[0]).toMatchObject({ timesSubmittedAt: now, timesUpdatedAt: now });
    expect(store.jobs).toEqual([['interview.times', { applicationId: 'app', interviewId: 'i1' }]]);
  });

  it('bumps the revision on a real change and does nothing for an identical set', async () => {
    const first = new Date('2026-10-16T12:00:00Z');
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1, timeZone: 'Europe/London', timesSubmittedAt: first });
    expect(await submitTimes('i1', 'applicant', [SLOT], 'America/New_York', now)).toMatchObject({ ok: true, interview: { timesRevision: 1, timeZone: 'Europe/London' } });
    expect(store.jobs).toEqual([]);
    expect(await submitTimes('i1', 'applicant', [SLOT, SLOT2], 'Europe/London', now)).toMatchObject({ ok: true, interview: { timesRevision: 2, slots: [SLOT, SLOT2] } });
    expect(store.rows[0]).toMatchObject({ timesSubmittedAt: first, timesUpdatedAt: now });
    expect(jobTypes()).toEqual(['interview.times']);
  });

  it.each([
    ['before the window', '2026-10-16T18:30:00Z'],
    ['after the window', '2026-10-23T17:30:00Z'],
    ['off the half hour', '2026-10-17T02:15:00Z'],
    ['outside interview hours', '2026-10-17T10:00:00Z'],
  ])('refuses a pick %s as out_of_range', async (_case, bad) => {
    interview();
    expect(await submitTimes('i1', 'applicant', [SLOT, bad], 'UTC', now)).toMatchObject({ ok: false, status: 400, reason: 'out_of_range' });
    expect(store.rows[0]).toMatchObject({ status: 'AWAITING_TIMES', timesRevision: 0 });
    expect(store.jobs).toEqual([]);
  });

  it('accepts picks on both window edges', async () => {
    interview();
    expect(await submitTimes('i1', 'applicant', ['2026-10-16T19:00:00Z', '2026-10-23T17:00:00Z'], 'UTC', now)).toMatchObject({ ok: true });
  });

  it.each([
    ['an empty set', [], 'UTC'],
    ['no list', 'soon', 'UTC'],
    ['a date that is not one', ['tomorrow'], 'UTC'],
    ['a missing zone', [SLOT], ''],
    ['an unknown zone', [SLOT], 'Mars/Olympus'],
  ])('refuses %s as invalid', async (_case, picks, zone) => {
    interview();
    expect(await submitTimes('i1', 'applicant', picks, zone, now)).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(store.jobs).toEqual([]);
  });

  it.each(['PROPOSED', 'BOOKED', 'DONE', 'CANCELLED', 'CLOSED'])('refuses a change while %s, naming the state', async (status) => {
    interview({ status });
    const result = await submitTimes('i1', 'applicant', [SLOT], 'UTC', now);
    expect(result).toMatchObject({ ok: false, status: 409, reason: 'wrong_status' });
    expect(result.ok ? '' : result.error).toMatch(status === 'BOOKED' ? /already booked/ : /./);
    expect(store.jobs).toEqual([]);
  });

  it('refuses anyone but the applicant, and an unknown interview', async () => {
    interview();
    expect(await submitTimes('i1', 'someone-else', [SLOT], 'UTC', now)).toMatchObject({ ok: false, status: 403, reason: 'forbidden' });
    expect(await submitTimes('nope', 'applicant', [SLOT], 'UTC', now)).toMatchObject({ ok: false, status: 404 });
    expect(store.rows[0]).toMatchObject({ status: 'AWAITING_TIMES' });
  });

  it('loses to a booking that lands first and reports the new state', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1 });
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { status: 'BOOKED' });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await submitTimes('i1', 'applicant', [SLOT2], 'UTC', now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview is already booked.' });
    expect(store.jobs).toEqual([]);
  });
  it('lets one of two competing edits win and refuses the other', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1 });
    const original = fake.interview.updateMany;
    // Another tab's edit lands between this one's read and its write.
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { slots: [new Date(SLOT2)], timesRevision: 2 });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await submitTimes('i1', 'applicant', [SLOT, SLOT2], 'UTC', now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: /changed while you were editing/ });
    expect(store.rows[0]).toMatchObject({ timesRevision: 2, slots: [new Date(SLOT2)] });
    expect(store.jobs).toEqual([]);
  });

  it('treats the same times arriving twice at once as one change', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1 });
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { slots: [new Date(SLOT2)], timesRevision: 2 });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await submitTimes('i1', 'applicant', [SLOT2], 'UTC', now)).toMatchObject({ ok: true, interview: { timesRevision: 2 } });
    expect(store.jobs).toEqual([]);
  });
});

describe('cancelling', () => {
  it('refuses a cancel that loses to a booking, naming the new state', async () => {
    interview({ status: 'TIMES_RECEIVED' });
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { status: 'BOOKED' });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await cancelInterview('i1', { userId: 'officer' }, now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview is already booked.' });
    expect(store.rows[0]).toMatchObject({ status: 'BOOKED', activeKey: 'app' });
    expect(store.jobs).toEqual([]);
  });

  it.each(['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED'])('ends a %s interview', async (status) => {
    interview({ status });
    expect(await cancelInterview('i1', { userId: 'officer' }, now)).toMatchObject({ ok: true, interview: { status: 'CANCELLED', endedAt: now.toISOString() } });
    expect(store.rows[0]).toMatchObject({ activeKey: null, endedById: 'officer' });
    expect(store.jobs[0]).toEqual(['interview.ended', { applicationId: 'app', interviewId: 'i1', outcome: 'cancelled' }]);
    expect(jobTypes()).toEqual(status === 'BOOKED' ? ['interview.ended', 'application.update'] : ['interview.ended']);
  });

  it.each(['DONE', 'CANCELLED', 'NO_TIME', 'CLOSED'])('refuses an ended (%s) interview', async (status) => {
    interview({ status });
    expect(await cancelInterview('i1', { userId: 'officer' }, now)).toMatchObject({ ok: false, status: 409, reason: 'not_active' });
    expect(store.jobs).toEqual([]);
  });

  it('refuses an unknown interview', async () => {
    expect(await cancelInterview('nope', { userId: 'officer' })).toMatchObject({ ok: false, status: 404 });
  });
});

describe('closing on a decision', () => {
  it('closes the active attempt and enqueues interview.ended (closed)', async () => {
    interview({ status: 'CANCELLED' });
    interview({ status: 'TIMES_RECEIVED' });
    expect(await closeActiveInterview('app', 'officer', now, fake as never)).toBe('i2');
    expect(store.rows.map((r) => r.status)).toEqual(['CANCELLED', 'CLOSED']);
    expect(store.rows[1]).toMatchObject({ activeKey: null, endedAt: now, endedById: 'officer' });
    expect(store.jobs).toEqual([['interview.ended', { applicationId: 'app', interviewId: 'i2', outcome: 'closed' }]]);
  });

  it('does nothing without an active attempt', async () => {
    interview({ status: 'DONE' });
    expect(await closeActiveInterview('app', 'officer', now, fake as never)).toBeNull();
    expect(store.jobs).toEqual([]);
  });
});

describe('reading', () => {
  it('gives an application its latest attempt without slots, or null', async () => {
    expect(await latestInterview('app')).toBeNull();
    interview({ status: 'CANCELLED' });
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)] });
    const latest = await latestInterview('app');
    expect(latest).toMatchObject({ id: 'i2', attempt: 2, status: 'TIMES_RECEIVED' });
    expect(latest).not.toHaveProperty('slots');
    expect(await getInterview('i2')).toMatchObject({ slots: [SLOT] });
    expect(await getInterview('nope')).toBeNull();
  });

  it('gives the applicant their active attempt, across their applications', async () => {
    interview({ status: 'CANCELLED', requestedAt: new Date('2026-10-15T00:00:00Z') });
    interview({ applicationId: 'app2', status: 'AWAITING_TIMES', requestedAt: new Date('2026-10-01T00:00:00Z') });
    expect(await applicantInterview('applicant')).toMatchObject({ id: 'i2', applicationId: 'app2', applicant: { characterName: 'Jaina' } });
  });

  it('gives the newest ended attempt when none is active, and null with none', async () => {
    expect(await applicantInterview('applicant')).toBeNull();
    interview({ status: 'NO_TIME', endReason: 'DECLINED', requestedAt: new Date('2026-10-01T00:00:00Z') });
    interview({ applicationId: 'app2', status: 'CANCELLED', requestedAt: new Date('2026-10-12T00:00:00Z') });
    interview({ status: 'DONE', requestedAt: new Date('2026-10-05T00:00:00Z') });
    expect(await applicantInterview('applicant')).toMatchObject({ id: 'i2', status: 'CANCELLED' });
    expect(await applicantInterview('someone-else')).toBeNull();
  });
});

describe('booking a time', () => {
  const received = (data: Partial<Row> = {}) => interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT), new Date(SLOT2)], timesRevision: 2, ...data });

  it('books one of the current slots, tags the application and enqueues the booking', async () => {
    received();
    const result = await bookInterview('i1', { userId: 'officer' }, SLOT2, 2, now);
    expect(result).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: SLOT2, bookedBy: { discordId: 'officer-discord' } } });
    expect(store.rows[0]).toMatchObject({ activeKey: 'app', bookedById: 'officer', bookedAt: now });
    expect(store.jobs).toEqual([['interview.booked', { applicationId: 'app', interviewId: 'i1', startsAt: SLOT2 }], ['application.update', { applicationId: 'app' }]]);
  });

  it.each([
    ['a stale times revision', SLOT, 1, 'times_changed', 'Thrall changed their times. Pick again.'],
    ['a time that is not one of the slots', pick('2026-10-17T03:00:00Z'), 2, 'not_a_slot', /Thrall's times/],
  ])('refuses %s', async (_case, startsAt, revision, reason, error) => {
    received();
    expect(await bookInterview('i1', { userId: 'officer' }, startsAt, revision, now)).toMatchObject({ ok: false, status: 409, reason, error });
    expect(store.rows[0]).toMatchObject({ status: 'TIMES_RECEIVED', bookedStart: null });
    expect(store.jobs).toEqual([]);
  });

  it('refuses a slot under 15 minutes away, and books one exactly 15 minutes away', async () => {
    received();
    const start = new Date(SLOT).getTime();
    expect(await bookInterview('i1', { userId: 'officer' }, SLOT, 2, new Date(start - 14 * 60_000))).toMatchObject({ ok: false, status: 409, reason: 'too_soon' });
    expect(store.jobs).toEqual([]);
    expect(await bookInterview('i1', { userId: 'officer' }, SLOT, 2, new Date(start - 15 * 60_000))).toMatchObject({ ok: true });
  });

  it.each(['AWAITING_TIMES', 'PROPOSED', 'BOOKED', 'CANCELLED', 'NO_TIME'])('refuses a %s interview, naming the state', async (status) => {
    received({ status });
    const result = await bookInterview('i1', { userId: 'officer' }, SLOT, 2, now);
    expect(result).toMatchObject({ ok: false, status: 409, reason: 'wrong_status' });
    expect(result.ok ? '' : result.error).toMatch(status === 'BOOKED' ? /already booked/ : /./);
    expect(store.jobs).toEqual([]);
  });

  it('refuses a malformed body and an unknown interview', async () => {
    received();
    expect(await bookInterview('i1', { userId: 'officer' }, 'tomorrow', 2, now)).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await bookInterview('i1', { userId: 'officer' }, SLOT, '2', now)).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await bookInterview('nope', { userId: 'officer' }, SLOT, 2, now)).toMatchObject({ ok: false, status: 404 });
  });

  it.each([
    ['another officer booking first', { status: 'BOOKED' }, 'wrong_status'],
    ['the applicant changing their times first', { timesRevision: 3 }, 'times_changed'],
  ])('loses to %s', async (_case, change, reason) => {
    received();
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], change);
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await bookInterview('i1', { userId: 'officer' }, SLOT, 2, now)).toMatchObject({ ok: false, status: 409, reason });
    expect(store.jobs).toEqual([]);
  });
});

describe('proposing a time', () => {
  const OTHER = pick('2026-10-17T03:00:00Z');

  it('proposes a slot in range and enqueues the proposal', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1 });
    const result = await proposeTime('i1', { userId: 'officer' }, OTHER, now);
    expect(result).toMatchObject({ ok: true, interview: { status: 'PROPOSED', proposedStart: OTHER, proposedBy: { discordId: 'officer-discord' }, bookedStart: null } });
    expect(store.rows[0]).toMatchObject({ proposedById: 'officer', proposedAt: now });
    expect(store.jobs).toEqual([['interview.proposed', { applicationId: 'app', interviewId: 'i1', startsAt: OTHER }]]);
  });

  it.each([
    ['under 2 hours ahead', '2026-10-16T18:30:00Z'],
    ['over 7 days ahead', '2026-10-23T17:30:00Z'],
    ['off the half hour', '2026-10-17T02:15:00Z'],
    ['outside interview hours', '2026-10-17T10:00:00Z'],
  ])('refuses a time %s as out_of_range', async (_case, bad) => {
    interview({ status: 'TIMES_RECEIVED' });
    expect(await proposeTime('i1', { userId: 'officer' }, bad, now)).toMatchObject({ ok: false, status: 400, reason: 'out_of_range' });
    expect(store.rows[0]).toMatchObject({ status: 'TIMES_RECEIVED', proposedStart: null });
    expect(store.jobs).toEqual([]);
  });

  it('accepts both range edges', async () => {
    interview({ status: 'TIMES_RECEIVED' });
    interview({ applicationId: 'app2', status: 'TIMES_RECEIVED' });
    expect(await proposeTime('i1', { userId: 'officer' }, '2026-10-16T19:00:00Z', now)).toMatchObject({ ok: true });
    expect(await proposeTime('i2', { userId: 'officer' }, '2026-10-23T17:00:00Z', now)).toMatchObject({ ok: true });
  });

  it('refuses a second proposal', async () => {
    interview({ status: 'TIMES_RECEIVED' });
    expect(await proposeTime('i1', { userId: 'officer' }, OTHER, now)).toMatchObject({ ok: true });
    expect(await proposeTime('i1', { userId: 'officer' }, SLOT, now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: /proposed a time/ });
    expect(store.rows[0]).toMatchObject({ proposedStart: new Date(OTHER) });
    expect(jobTypes()).toEqual(['interview.proposed']);
  });

  it.each(['AWAITING_TIMES', 'BOOKED', 'CANCELLED'])('refuses a %s interview', async (status) => {
    interview({ status });
    expect(await proposeTime('i1', { userId: 'officer' }, OTHER, now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status' });
    expect(store.jobs).toEqual([]);
  });

  it('refuses a malformed time, an unknown interview, and a proposal that loses to a booking', async () => {
    interview({ status: 'TIMES_RECEIVED' });
    expect(await proposeTime('i1', { userId: 'officer' }, 42, now)).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await proposeTime('nope', { userId: 'officer' }, OTHER, now)).toMatchObject({ ok: false, status: 404 });
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { status: 'BOOKED' });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await proposeTime('i1', { userId: 'officer' }, OTHER, now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview is already booked.' });
    expect(store.jobs).toEqual([]);
  });
});

describe('answering a proposal', () => {
  const proposed = (data: Partial<Row> = {}) => interview({ status: 'PROPOSED', proposedStart: new Date(SLOT), proposedById: 'officer', ...data });

  it('books the proposed time on accept, with the proposer as the booking officer', async () => {
    proposed();
    expect(await answerProposal('i1', 'applicant', 'accept', now)).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: SLOT, bookedBy: { discordId: 'officer-discord' } } });
    expect(store.rows[0]).toMatchObject({ bookedById: 'officer', bookedAt: now, activeKey: 'app' });
    expect(store.jobs).toEqual([['interview.booked', { applicationId: 'app', interviewId: 'i1', startsAt: SLOT }], ['application.update', { applicationId: 'app' }]]);
  });

  it('ends the interview on decline, recording the applicant', async () => {
    store.users.push({ id: 'applicant-user', discordId: 'applicant', discordName: 'Thrall' });
    proposed();
    expect(await answerProposal('i1', 'applicant', 'decline', now)).toMatchObject({ ok: true, interview: { status: 'NO_TIME', endReason: 'DECLINED', endedAt: now.toISOString() } });
    expect(store.rows[0]).toMatchObject({ activeKey: null, endedById: 'applicant-user' });
    expect(store.jobs).toEqual([['interview.ended', { applicationId: 'app', interviewId: 'i1', outcome: 'declined' }]]);
  });

  it('refuses accepting under 15 minutes before the start, but still takes a decline', async () => {
    proposed();
    const late = new Date(new Date(SLOT).getTime() - 10 * 60_000);
    expect(await answerProposal('i1', 'applicant', 'accept', late)).toMatchObject({ ok: false, status: 409, reason: 'too_soon' });
    expect(store.rows[0]).toMatchObject({ status: 'PROPOSED' });
    expect(store.jobs).toEqual([]);
    expect(await answerProposal('i1', 'applicant', 'decline', late)).toMatchObject({ ok: true, interview: { status: 'NO_TIME' } });
    expect(store.rows[0]).toMatchObject({ endedById: null });
  });

  it("refuses answering someone else's proposal", async () => {
    proposed();
    expect(await answerProposal('i1', 'someone-else', 'accept', now)).toMatchObject({ ok: false, status: 403, reason: 'forbidden' });
    expect(store.rows[0]).toMatchObject({ status: 'PROPOSED' });
    expect(store.jobs).toEqual([]);
  });

  it.each(['TIMES_RECEIVED', 'BOOKED', 'CANCELLED', 'NO_TIME'])('refuses answering a %s interview', async (status) => {
    proposed({ status });
    expect(await answerProposal('i1', 'applicant', 'decline', now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status' });
    expect(store.jobs).toEqual([]);
  });

  it('refuses an unknown answer and an unknown interview', async () => {
    proposed();
    expect(await answerProposal('i1', 'applicant', 'maybe', now)).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await answerProposal('nope', 'applicant', 'accept', now)).toMatchObject({ ok: false, status: 404 });
  });

  it('loses an accept to a cancel that lands first', async () => {
    proposed();
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { status: 'CANCELLED', activeKey: null });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await answerProposal('i1', 'applicant', 'accept', now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview was cancelled.' });
    expect(store.jobs).toEqual([]);
  });
});
