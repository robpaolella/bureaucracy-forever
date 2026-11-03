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
  if (want instanceof Date && have instanceof Date) return want.getTime() === have.getTime();
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
    count: async ({ where }: { where: Record<string, unknown> }) => store.rows.filter((r) => match(r, where)).length,
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
  $executeRaw: async () => 1,
  $queryRaw: async (_sql: TemplateStringsArray, id: string) => store.apps.filter((a) => a.id === id),
}));
vi.mock('@/lib/db', () => ({ db: { ...fake, $transaction: async (fn: (tx: typeof fake) => unknown) => fn(fake) } }));
vi.mock('@/lib/outbox', () => ({ enqueue: async (type: string, payload: Record<string, unknown>) => { store.jobs.push([type, payload]); return 'job'; } }));
vi.mock('@/lib/generated/prisma/client', () => ({ Prisma: { PrismaClientKnownRequestError: KnownError } }));
import { answerProposal, applicantInterview, bookInterview, cancelInterview, closeActiveInterview, getInterview, interviewCard, latestInterview, proposeTime, rescheduleInterview, startInterview, submitTimes } from './interviews';
import { interviewDone, interviewReminderDue, joinNoticeDue, type TickInterview } from './tick-rules';

const now = new Date('2026-10-16T17:00:00Z'); // 10:00 AM guild time
const pick = (iso: string) => new Date(iso).toISOString();
const SLOT = pick('2026-10-17T02:00:00Z'); // 7:00 PM guild time, the 16th
const SLOT2 = pick('2026-10-17T02:30:00Z');
// With SLOT: five one-hour blocks on two guild days (the 16th at 7, 8 and 9 PM; the 17th at 10 and 11 AM).
const REST = [pick('2026-10-17T03:00:00Z'), pick('2026-10-17T04:00:00Z'), pick('2026-10-17T17:00:00Z'), pick('2026-10-17T18:00:00Z')];
const ENOUGH = [SLOT, ...REST];
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
    const result = await submitTimes('i1', 'applicant', [SLOT2, ...ENOUGH, SLOT], 'Europe/London', now);
    expect(result).toMatchObject({ ok: true, interview: { status: 'TIMES_RECEIVED', timesRevision: 1, timeZone: 'Europe/London', slots: [SLOT, SLOT2, ...REST] } });
    expect(store.rows[0]).toMatchObject({ timesSubmittedAt: now, timesUpdatedAt: now });
    expect(store.jobs).toEqual([['interview.times', { applicationId: 'app', interviewId: 'i1' }]]);
  });

  it('bumps the revision on a real change and does nothing for an identical set', async () => {
    const first = new Date('2026-10-16T12:00:00Z');
    interview({ status: 'TIMES_RECEIVED', slots: ENOUGH.map((t) => new Date(t)), timesRevision: 1, timeZone: 'Europe/London', timesSubmittedAt: first });
    expect(await submitTimes('i1', 'applicant', ENOUGH, 'America/New_York', now)).toMatchObject({ ok: true, interview: { timesRevision: 1, timeZone: 'Europe/London' } });
    expect(store.jobs).toEqual([]);
    expect(await submitTimes('i1', 'applicant', [...ENOUGH, SLOT2], 'Europe/London', now)).toMatchObject({ ok: true, interview: { timesRevision: 2, slots: [SLOT, SLOT2, ...REST] } });
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
    expect(await submitTimes('i1', 'applicant', ['2026-10-16T19:00:00Z', '2026-10-23T17:00:00Z', SLOT, REST[0], REST[1]], 'UTC', now)).toMatchObject({ ok: true });
  });

  it.each([
    ['4 blocks on 2 days', [SLOT, SLOT2, REST[0], REST[2], REST[3]], /1 more one-hour block\./],
    ['5 blocks on 1 day', ['2026-10-16T19:00:00Z', '2026-10-16T20:00:00Z', '2026-10-16T21:00:00Z', '2026-10-16T22:00:00Z', '2026-10-16T23:00:00Z'], /at least 2 different days/],
    ['one pick', [SLOT], /4 more one-hour blocks and at least 2 different days/],
  ])('refuses %s as too_few_times and writes nothing', async (_case, picks, message) => {
    interview();
    const result = await submitTimes('i1', 'applicant', picks, 'UTC', now);
    expect(result).toMatchObject({ ok: false, status: 400, reason: 'too_few_times' });
    expect(result.ok ? '' : result.error).toMatch(message);
    expect(store.rows[0]).toMatchObject({ status: 'AWAITING_TIMES', timesRevision: 0, slots: [] });
    expect(store.jobs).toEqual([]);
  });

  it('holds a change of sent times to the same minimum', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: ENOUGH.map((t) => new Date(t)), timesRevision: 1 });
    expect(await submitTimes('i1', 'applicant', ENOUGH.slice(0, 4), 'UTC', now)).toMatchObject({ ok: false, status: 400, reason: 'too_few_times' });
    expect(store.rows[0]).toMatchObject({ timesRevision: 1, slots: ENOUGH.map((t) => new Date(t)) });
    expect(store.jobs).toEqual([]);
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
    expect(await submitTimes('i1', 'applicant', ENOUGH, 'UTC', now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: 'This interview is already booked.' });
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
    expect(await submitTimes('i1', 'applicant', ENOUGH, 'UTC', now)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: /changed while you were editing/ });
    expect(store.rows[0]).toMatchObject({ timesRevision: 2, slots: [new Date(SLOT2)] });
    expect(store.jobs).toEqual([]);
  });

  it('refuses, writing nothing, when the times moved past the revision the caller saw', async () => {
    // Another tab saved revision 2 after this page checked revision 1.
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT2)], timesRevision: 2 });
    expect(await submitTimes('i1', 'applicant', ENOUGH, 'UTC', now, 1)).toMatchObject({ ok: false, status: 409, reason: 'wrong_status', error: /changed while you were editing/ });
    expect(store.rows[0]).toMatchObject({ timesRevision: 2, slots: [new Date(SLOT2)] });
    expect(store.jobs).toEqual([]);
  });

  it('writes when the revision the caller saw is still current', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1 });
    expect(await submitTimes('i1', 'applicant', ENOUGH, 'UTC', now, 1)).toMatchObject({ ok: true, interview: { timesRevision: 2 } });
    expect(store.jobs.map(([type]) => type)).toEqual(['interview.times']);
  });

  it('treats the same times arriving twice at once as one change', async () => {
    interview({ status: 'TIMES_RECEIVED', slots: [new Date(SLOT)], timesRevision: 1 });
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], { slots: ENOUGH.map((t) => new Date(t)), timesRevision: 2 });
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await submitTimes('i1', 'applicant', ENOUGH, 'UTC', now)).toMatchObject({ ok: true, interview: { timesRevision: 2 } });
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

describe('the officer interview card', () => {
  it('is null when the application never had an interview', async () => {
    expect(await interviewCard('app')).toBeNull();
  });

  it('gives the latest attempt with times and names, and no earlier line for a first interview', async () => {
    interview({ status: 'PROPOSED', slots: [new Date(SLOT)], proposedStart: new Date(SLOT2), proposedById: 'officer' });
    expect(await interviewCard('app')).toMatchObject({ attempt: 1, status: 'PROPOSED', slots: [SLOT], proposedBy: 'Robert', proposedStart: SLOT2, requestedBy: 'Robert', earlier: null });
  });

  it.each([
    ['DONE', { bookedStart: new Date(SLOT), endedAt: new Date('2026-10-18T00:00:00Z') }, SLOT],
    ['CANCELLED', { endedAt: new Date('2026-10-14T00:00:00Z') }, '2026-10-14T00:00:00.000Z'],
    ['NO_TIME', { endedAt: new Date('2026-10-13T00:00:00Z'), endReason: 'DECLINED' }, '2026-10-13T00:00:00.000Z'],
    ['CLOSED', { endedAt: new Date('2026-10-12T00:00:00Z') }, '2026-10-12T00:00:00.000Z'],
  ])('shows the latest attempt and how the earlier %s one ended', async (status, data, at) => {
    interview({ status, ...data });
    interview({ status: 'AWAITING_TIMES' });
    expect(await interviewCard('app')).toMatchObject({ attempt: 2, status: 'AWAITING_TIMES', earlier: { status, at } });
  });

  it('names who cancelled, and keeps no booked time for a cancel before any booking', async () => {
    interview({ status: 'CANCELLED', endedById: 'officer', endedAt: now });
    expect(await interviewCard('app')).toMatchObject({ status: 'CANCELLED', endedBy: 'Robert', endedAt: now.toISOString(), bookedStart: null });
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

  it('returns the message ids the bot reported, so it can edit or strip those messages', async () => {
    interview({ status: 'BOOKED', bookedStart: new Date(SLOT), requestDmId: 'd1', timesMessageId: 'm1', bookedMessageId: 'm2' });
    expect(await getInterview('i1')).toMatchObject({ requestDmId: 'd1', timesMessageId: 'm1', bookedMessageId: 'm2', proposalMessageId: null, proposalDmId: null });
  });

  it('returns the booking token: bookedAt as ISO while booked, null before a booking', async () => {
    interview({ status: 'BOOKED', bookedStart: new Date(SLOT), bookedAt: now });
    interview({ applicationId: 'app2', status: 'TIMES_RECEIVED', bookedAt: null });
    expect(await getInterview('i1')).toMatchObject({ bookedStart: SLOT, bookedAt: now.toISOString() });
    expect(await getInterview('i2')).toMatchObject({ bookedStart: null, bookedAt: null });
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
    expect(store.jobs).toEqual([['interview.booked', { applicationId: 'app', interviewId: 'i1', startsAt: SLOT2, bookedAt: now.toISOString() }], ['application.update', { applicationId: 'app' }]]);
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

  it('books a quarter hour after a picked slot, and refuses one that is not bookable', async () => {
    received();
    const quarter = pick('2026-10-17T02:15:00Z'); // 7:15 PM, SLOT is 7:00 PM
    expect(await bookInterview('i1', { userId: 'officer' }, pick('2026-10-17T02:10:00Z'), 2, now)).toMatchObject({ ok: false, status: 409, reason: 'not_a_slot' });
    expect(await bookInterview('i1', { userId: 'officer' }, pick('2026-10-17T01:45:00Z'), 2, now)).toMatchObject({ ok: false, status: 409, reason: 'not_a_slot' });
    expect(await bookInterview('i1', { userId: 'officer' }, quarter, 2, now)).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: quarter } });
  });

  it('refuses a quarter hour when only the half hour after it is picked', async () => {
    received({ slots: [new Date(SLOT2)] });
    expect(await bookInterview('i1', { userId: 'officer' }, pick('2026-10-17T02:15:00Z'), 2, now)).toMatchObject({ ok: false, status: 409, reason: 'not_a_slot' });
    expect(await bookInterview('i1', { userId: 'officer' }, pick('2026-10-17T02:45:00Z'), 2, now)).toMatchObject({ ok: true });
  });

  it('refuses a bookable quarter hour under 15 minutes away as too_soon', async () => {
    received();
    const quarter = new Date('2026-10-17T02:15:00Z').getTime();
    expect(await bookInterview('i1', { userId: 'officer' }, pick('2026-10-17T02:15:00Z'), 2, new Date(quarter - 14 * 60_000))).toMatchObject({ ok: false, status: 409, reason: 'too_soon' });
  });

  describe('clashes', () => {
    const clashes = () => store.jobs.filter(([t]) => t === 'interview.clash');
    const book = (id = 'i2') => bookInterview(id, { userId: 'officer' }, SLOT, 2, now);
    const other = (data: Partial<Row>) => interview({ applicationId: 'app2', bookedStart: new Date(SLOT), ...data });

    it('enqueues one clash for a booking at an already booked start, and still books', async () => {
      other({ status: 'BOOKED' });
      received({ applicationId: 'app' });
      expect(await book()).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: SLOT } });
      expect(clashes()).toEqual([['interview.clash', { applicationId: 'app', interviewId: 'i2', startsAt: SLOT }]]);
      expect(store.jobs.map(([t]) => t)).toEqual(['interview.booked', 'application.update', 'interview.clash']);
    });

    it('enqueues none at a free start, or at a different start', async () => {
      other({ status: 'BOOKED', bookedStart: new Date(SLOT2) });
      received({ applicationId: 'app' });
      expect(await book()).toMatchObject({ ok: true });
      expect(clashes()).toEqual([]);
    });

    it.each(['PROPOSED', 'DONE', 'CANCELLED'])('enqueues none when the other interview at that start is %s', async (status) => {
      other({ status });
      received({ applicationId: 'app' });
      expect(await book()).toMatchObject({ ok: true });
      expect(clashes()).toEqual([]);
    });
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
    ['off the quarter hour', '2026-10-17T02:10:00Z'],
    ['before interview hours (8:45 AM)', '2026-10-17T15:45:00Z'],
    ['after interview hours (11:00 PM)', '2026-10-17T06:00:00Z'],
    ['outside interview hours', '2026-10-17T10:00:00Z'],
  ])('refuses a time %s as out_of_range', async (_case, bad) => {
    interview({ status: 'TIMES_RECEIVED' });
    expect(await proposeTime('i1', { userId: 'officer' }, bad, now)).toMatchObject({ ok: false, status: 400, reason: 'out_of_range', error: 'Propose a start time on the quarter hour, from 2 hours to 7 days ahead.' });
    expect(store.rows[0]).toMatchObject({ status: 'TIMES_RECEIVED', proposedStart: null });
    expect(store.jobs).toEqual([]);
  });

  it.each([['7:15 PM', '2026-10-17T02:15:00.000Z'], ['10:45 PM', '2026-10-17T05:45:00.000Z']])('accepts %s', async (_case, ok) => {
    interview({ status: 'TIMES_RECEIVED' });
    expect(await proposeTime('i1', { userId: 'officer' }, ok, now)).toMatchObject({ ok: true, interview: { status: 'PROPOSED', proposedStart: ok } });
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
    expect(store.jobs).toEqual([['interview.booked', { applicationId: 'app', interviewId: 'i1', startsAt: SLOT, bookedAt: now.toISOString() }], ['application.update', { applicationId: 'app' }]]);
  });

  it('books a quarter-hour proposal on accept', async () => {
    const quarter = pick('2026-10-17T02:15:00Z');
    proposed({ proposedStart: new Date(quarter) });
    expect(await answerProposal('i1', 'applicant', 'accept', now)).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: quarter } });
  });

  it('enqueues a clash when the accepted proposal lands on a booked start, and still books', async () => {
    interview({ applicationId: 'app2', status: 'BOOKED', bookedStart: new Date(SLOT) });
    proposed({ applicationId: 'app' });
    expect(await answerProposal('i2', 'applicant', 'accept', now)).toMatchObject({ ok: true, interview: { status: 'BOOKED' } });
    expect(store.jobs.map(([t]) => t)).toEqual(['interview.booked', 'application.update', 'interview.clash']);
    expect(store.jobs[2]).toEqual(['interview.clash', { applicationId: 'app', interviewId: 'i2', startsAt: SLOT }]);
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

describe('rescheduling a booking', () => {
  const BOOKED_AT = new Date('2026-10-16T16:00:00Z');
  const QUARTER = pick('2026-10-17T02:15:00Z'); // 7:15 PM, inside SLOT's half hour
  const mover = { userId: 'officer2' };
  const booked = (data: Partial<Row> = {}) => interview({ status: 'BOOKED', slots: [new Date(SLOT), new Date(SLOT2)], timesRevision: 1, bookedStart: new Date(SLOT), bookedById: 'officer', bookedAt: BOOKED_AT, remindedAt: null, joinedNotifiedAt: null, bookedMessageId: 'line1', ...data });
  const move = (startsAt: unknown, token: unknown = BOOKED_AT.toISOString(), at = now) => rescheduleInterview('i1', mover, startsAt, token, at);
  beforeEach(() => { store.users.push({ id: 'officer2', discordId: 'officer2-discord', discordName: 'Sylvanas' }); });

  it('moves to a bookable start: the mover takes it over, the token advances and interview.moved is queued', async () => {
    booked({ remindedAt: new Date('2026-10-16T16:30:00Z'), joinedNotifiedAt: new Date('2026-10-16T16:40:00Z') });
    const result = await move(SLOT2);
    expect(result).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: SLOT2, bookedAt: now.toISOString(), bookedBy: { discordId: 'officer2-discord', name: 'Sylvanas' }, bookedMessageId: 'line1' } });
    expect(store.rows[0]).toMatchObject({ bookedById: 'officer2', bookedAt: now, remindedAt: null, joinedNotifiedAt: null, timesRevision: 1, activeKey: 'app' });
    expect(store.jobs).toEqual([['interview.moved', { applicationId: 'app', interviewId: 'i1', startsAt: SLOT2, bookedAt: now.toISOString(), previousStart: SLOT, previousBookedBy: { discordId: 'officer-discord', name: 'Robert' } }]]);
  });

  it('moves to a quarter hour after a picked slot, and sends a null previous officer when none is known', async () => {
    booked({ bookedById: null });
    expect(await move(QUARTER)).toMatchObject({ ok: true, interview: { bookedStart: QUARTER } });
    expect(store.jobs[0][1]).toMatchObject({ previousBookedBy: null });
  });

  it('enqueues interview.clash when the new start is another booking\'s, and still moves', async () => {
    booked();
    interview({ applicationId: 'app2', status: 'BOOKED', bookedStart: new Date(SLOT2) });
    expect(await move(SLOT2)).toMatchObject({ ok: true });
    expect(jobTypes()).toEqual(['interview.moved', 'interview.clash']);
    expect(store.jobs[1]).toEqual(['interview.clash', { applicationId: 'app', interviewId: 'i1', startsAt: SLOT2 }]);
  });

  it('moves a no-show after its start, while it is still BOOKED', async () => {
    booked({ slots: [new Date(SLOT), new Date(REST[0])] });
    const late = new Date(new Date(SLOT).getTime() + 10 * 60_000);
    expect(await move(REST[0], BOOKED_AT.toISOString(), late)).toMatchObject({ ok: true, interview: { status: 'BOOKED', bookedStart: REST[0] } });
  });

  it('always advances the token, so A → B → A refuses the first token as moved', async () => {
    booked();
    const first = await move(SLOT2);
    if (!first.ok) throw new Error(first.error);
    // Same clock: the token still moves on by a millisecond.
    const back = await move(SLOT, first.interview.bookedAt, now);
    expect(back).toMatchObject({ ok: true, interview: { bookedStart: SLOT, bookedAt: new Date(now.getTime() + 1).toISOString() } });
    store.jobs = [];
    expect(await move(SLOT2)).toEqual({ ok: false, status: 409, reason: 'moved', error: "Thrall's interview was moved by Sylvanas. Run /reschedule again." });
    expect(store.rows[0]).toMatchObject({ bookedStart: new Date(SLOT) });
    expect(store.jobs).toEqual([]);
  });

  it('takes a token later than now one millisecond on', async () => {
    const ahead = new Date(now.getTime() + 60_000);
    booked({ bookedAt: ahead });
    expect(await move(SLOT2, ahead.toISOString())).toMatchObject({ ok: true, interview: { bookedAt: new Date(ahead.getTime() + 1).toISOString() } });
  });

  it.each(['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'DONE', 'CANCELLED', 'NO_TIME', 'CLOSED'])('refuses a %s interview as wrong_status, naming the state', async (status) => {
    booked({ status });
    const result = await move(SLOT2);
    expect(result).toMatchObject({ ok: false, status: 409, reason: 'wrong_status' });
    expect(result.ok ? '' : result.error).toBe({ AWAITING_TIMES: 'This interview is waiting for times.', TIMES_RECEIVED: 'Times are in for this interview.', PROPOSED: 'An officer has proposed a time for this interview.', DONE: 'This interview has already taken place.', CANCELLED: 'This interview was cancelled.', NO_TIME: 'No time was found for this interview.', CLOSED: 'This interview ended when the application was decided.' }[status]);
    expect(store.jobs).toEqual([]);
  });

  it.each([
    ['a stale token', SLOT2, '2026-10-16T15:00:00.000Z', 'moved', "Thrall's interview was moved by Robert. Run /reschedule again."],
    ['the current start', SLOT, undefined, 'same_time', "That's already the interview time."],
    ['a start that is not bookable', pick('2026-10-17T03:00:00Z'), undefined, 'not_a_slot', "That isn't one of Thrall's times."],
  ])('refuses %s', async (_case, startsAt, token, reason, error) => {
    booked();
    expect(await move(startsAt, token ?? BOOKED_AT.toISOString())).toEqual({ ok: false, status: 409, reason, error });
    expect(store.rows[0]).toMatchObject({ bookedStart: new Date(SLOT), bookedAt: BOOKED_AT, bookedById: 'officer' });
    expect(store.jobs).toEqual([]);
  });

  it('checks a stale token before the start, even one that does not parse', async () => {
    booked();
    const stale = '2026-10-16T15:00:00.000Z';
    expect(await move(SLOT, stale)).toMatchObject({ reason: 'moved' });
    expect(await move(pick('2026-10-17T03:00:00Z'), stale)).toMatchObject({ reason: 'moved' });
    expect(await move('tomorrow', stale)).toMatchObject({ status: 409, reason: 'moved' });
  });

  it('refuses a start under 15 minutes away as too_soon, and moves to one exactly 15 minutes away', async () => {
    booked();
    const start = new Date(SLOT2).getTime();
    expect(await move(SLOT2, BOOKED_AT.toISOString(), new Date(start - 14 * 60_000))).toMatchObject({ ok: false, status: 409, reason: 'too_soon', error: 'That time starts in less than 15 minutes. Pick a later one.' });
    expect(store.jobs).toEqual([]);
    expect(await move(SLOT2, BOOKED_AT.toISOString(), new Date(start - 15 * 60_000))).toMatchObject({ ok: true });
  });

  it('refuses a body that does not parse, and an unknown interview', async () => {
    booked();
    expect(await move('tomorrow')).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await move(SLOT2, null)).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await move(SLOT2, 'soon')).toMatchObject({ ok: false, status: 400, reason: 'invalid' });
    expect(await rescheduleInterview('nope', mover, SLOT2, BOOKED_AT.toISOString(), now)).toMatchObject({ ok: false, status: 404 });
    expect(store.jobs).toEqual([]);
  });

  it.each([
    ['another move', { bookedAt: new Date('2026-10-16T16:59:00Z'), bookedById: 'officer2' }, 'moved', "Thrall's interview was moved by Sylvanas. Run /reschedule again."],
    ['a cancel', { status: 'CANCELLED', activeKey: null }, 'wrong_status', 'This interview was cancelled.'],
    ["the tick's DONE step", { status: 'DONE', activeKey: null }, 'wrong_status', 'This interview has already taken place.'],
  ])('loses to %s that lands first', async (_case, change, reason, error) => {
    booked();
    const original = fake.interview.updateMany;
    fake.interview.updateMany = async (args) => {
      Object.assign(store.rows[0], change);
      fake.interview.updateMany = original;
      return original(args);
    };
    expect(await move(SLOT2)).toEqual({ ok: false, status: 409, reason, error });
    expect(store.jobs).toEqual([]);
  });

  it('moves the timers with it: the reminder, the joined notice and DONE follow the new start', async () => {
    const old = new Date(SLOT).getTime();
    booked({ remindedAt: new Date(old - 4 * 60_000), joinedNotifiedAt: new Date(old - 2 * 60_000) });
    const minute = (base: string, n: number) => new Date(new Date(base).getTime() + n * 60_000);
    // Already reminded and announced for the old booking, the old start is due nothing more.
    expect(await move(SLOT2, BOOKED_AT.toISOString(), minute(SLOT, -20))).toMatchObject({ ok: true });
    const row = store.rows[0] as unknown as TickInterview;
    expect(interviewReminderDue(row, minute(SLOT, -4))).toBe(false);
    expect(interviewReminderDue(row, minute(SLOT2, -4))).toBe(true);
    expect(joinNoticeDue(row, minute(SLOT2, -10))).toBe(true);
    expect(interviewDone(row, minute(SLOT, 60))).toBe(false);
    expect(interviewDone(row, minute(SLOT2, 59))).toBe(false);
    expect(interviewDone(row, minute(SLOT2, 60))).toBe(true);
  });

  it("shows the new time and officer on the applicant's page and the officer card", async () => {
    booked();
    await move(QUARTER);
    expect(await applicantInterview('applicant')).toMatchObject({ status: 'BOOKED', bookedStart: QUARTER, bookedBy: { name: 'Sylvanas' } });
    expect(await interviewCard('app')).toMatchObject({ status: 'BOOKED', bookedStart: QUARTER, bookedBy: 'Sylvanas' });
  });
});
