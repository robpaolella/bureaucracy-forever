import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; applicationId: string; discordId: string; status: string; bookedStart: Date | null; joinedNotifiedAt: Date | null; [k: string]: unknown };
const store = vi.hoisted(() => ({ rows: [] as Row[], enqueue: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/outbox', () => ({ enqueue: store.enqueue }));
vi.mock('@/lib/db', () => {
  const tx = {
    interview: {
      findMany: async ({ where }: { where: { status: string; joinedNotifiedAt: null; application: { discordId: string }; bookedStart: { gte: Date; lte: Date } } }) =>
        store.rows.filter((r) => r.status === where.status && r.joinedNotifiedAt === null && r.discordId === where.application.discordId && r.bookedStart && r.bookedStart >= where.bookedStart.gte && r.bookedStart <= where.bookedStart.lte),
      updateMany: async ({ where, data }: { where: { id: string; status: string; joinedNotifiedAt: null }; data: { joinedNotifiedAt: Date } }) => {
        const row = store.rows.find((r) => r.id === where.id && r.status === where.status && r.joinedNotifiedAt === null);
        if (!row) return { count: 0 };
        row.joinedNotifiedAt = data.joinedNotifiedAt;
        return { count: 1 };
      },
    },
  };
  return { db: { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import { POST } from './route';

const MEMBER = '100000000000000002';
const OTHER = '100000000000000003';
const now = new Date();
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);
const seed = (over: Partial<Row> = {}) => store.rows.push({ id: 'i1', applicationId: 'a1', discordId: MEMBER, status: 'BOOKED', bookedStart: minutes(5), joinedNotifiedAt: null, ...over });
const call = (body: unknown, secret: string | null = 'test-secret') =>
  POST(new Request('https://example.test/api/bot/interviews/voice-join', { method: 'POST', headers: { ...(secret ? { authorization: `Bearer ${secret}` } : {}), 'content-type': 'application/json' }, body: JSON.stringify(body) }));

describe('POST /api/bot/interviews/voice-join', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.rows = [];
    store.enqueue.mockReset();
  });

  it('refuses a missing or bad signature', async () => {
    seed();
    expect((await call({ discordId: MEMBER, channelId: 'c' }, null)).status).toBe(401);
    expect((await call({ discordId: MEMBER, channelId: 'c' }, 'wrong')).status).toBe(401);
    expect(store.enqueue).not.toHaveBeenCalled();
  });
  it('refuses a body without a Discord id', async () => {
    expect((await call({ channelId: 'c' })).status).toBe(400);
  });
  it('notifies once inside the window, and a repeat changes nothing', async () => {
    seed();
    const first = await call({ discordId: MEMBER, channelId: 'c' });
    expect(await first.json()).toEqual({ notified: true, interviewId: 'i1' });
    expect(store.enqueue).toHaveBeenCalledExactlyOnceWith('interview.joined', { applicationId: 'a1', interviewId: 'i1' }, expect.anything());
    expect(store.rows[0].joinedNotifiedAt).toBeInstanceOf(Date);
    expect(await (await call({ discordId: MEMBER, channelId: 'c' })).json()).toEqual({ notified: false });
    expect(store.enqueue).toHaveBeenCalledTimes(1);
  });
  it.each([[15], [0], [-29]])('notifies when the start is %i minutes ahead', async (ahead) => {
    seed({ bookedStart: minutes(ahead) });
    expect(await (await call({ discordId: MEMBER, channelId: 'c' })).json()).toEqual({ notified: true, interviewId: 'i1' });
  });
  it('does not notify outside the window', async () => {
    seed({ bookedStart: minutes(16) });
    expect(await (await call({ discordId: MEMBER, channelId: 'c' })).json()).toEqual({ notified: false });
    store.rows = [];
    seed({ bookedStart: minutes(-31) });
    expect(await (await call({ discordId: MEMBER, channelId: 'c' })).json()).toEqual({ notified: false });
    expect(store.enqueue).not.toHaveBeenCalled();
  });
  it('does not notify for another member or a non-booked interview', async () => {
    seed();
    expect(await (await call({ discordId: OTHER, channelId: 'c' })).json()).toEqual({ notified: false });
    store.rows = [];
    for (const status of ['AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'DONE', 'CANCELLED', 'NO_TIME', 'CLOSED']) seed({ id: status, status });
    expect(await (await call({ discordId: MEMBER, channelId: 'c' })).json()).toEqual({ notified: false });
    expect(store.enqueue).not.toHaveBeenCalled();
  });
});
