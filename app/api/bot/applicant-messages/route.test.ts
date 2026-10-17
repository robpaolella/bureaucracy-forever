import { beforeEach, describe, expect, it, vi } from 'vitest';

type App = { id: string; discordId: string; status: string; createdAt: Date; reopenedAt: Date | null; decidedAt: Date | null };
type Msg = { id: string; applicationId: string; direction: string; dmMessageId: string | null; body: string; createdAt: Date; attachments: unknown; dmChannelId: string | null };
const store = vi.hoisted(() => ({ apps: [] as App[], messages: [] as Msg[], enqueue: vi.fn(), raceOnCreate: false }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/outbox', () => ({ enqueue: store.enqueue }));
vi.mock('@/lib/db', async () => {
  const { Prisma } = await import('@/lib/generated/prisma/client');
  const tx = {
    application: {
      findFirst: async ({ where }: { where: { discordId: string } }) =>
        store.apps.filter((a) => a.discordId === where.discordId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
    },
    applicantMessage: {
      findUnique: async ({ where }: { where: { dmMessageId: string } }) => store.messages.find((m) => m.dmMessageId === where.dmMessageId) ?? null,
      create: async ({ data }: { data: Omit<Msg, 'id'> }) => {
        if (store.raceOnCreate) {
          store.messages.push({ ...data, id: 'raced' });
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
        }
        const row = { ...data, id: `m${store.messages.length + 1}` };
        store.messages.push(row);
        return row;
      },
    },
  };
  return { db: { ...tx, $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } };
});

import { POST } from './route';

const THRALL = '100000000000000001';
const created = new Date('2026-10-12T15:30:00Z');
const seed = (over: Partial<App> = {}) => store.apps.push({ id: 'a1', discordId: THRALL, status: 'PENDING', createdAt: created, reopenedAt: null, decidedAt: null, ...over });
const dm = (over: Record<string, unknown> = {}) => ({
  discordId: THRALL, dmChannelId: '100000000000000002', dmMessageId: '100000000000000003', body: 'Hello officers', createdAt: '2026-10-12T16:00:00.000Z', attachments: [], ...over,
});
const call = (body: unknown, { secret = 'test-secret' as string | null, raw }: { secret?: string | null; raw?: string } = {}) =>
  POST(new Request('https://example.test/api/bot/applicant-messages', {
    method: 'POST',
    headers: { ...(secret ? { authorization: `Bearer ${secret}` } : {}), 'content-type': 'application/json' },
    body: raw ?? JSON.stringify(body),
  }));
const json = async (body: unknown) => {
  const res = await call(body);
  return { status: res.status, body: await res.json() };
};

describe('POST /api/bot/applicant-messages', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.apps = [];
    store.messages = [];
    store.raceOnCreate = false;
    store.enqueue.mockReset();
  });

  it('refuses a request without the bot secret', async () => {
    seed();
    expect((await call(dm(), { secret: null })).status).toBe(401);
    expect((await call(dm(), { secret: 'wrong' })).status).toBe(401);
    expect(store.messages).toHaveLength(0);
  });

  it('refuses a body over the size limit with 413', async () => {
    const res = await call(null, { raw: JSON.stringify(dm({ body: 'a'.repeat(70_000) })) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it('stores a DM to a pending application as sent and queues its copy', async () => {
    seed();
    const file = { id: '100000000000000009', filename: 'shot.png', size: 1200, spoiler: true };
    expect(await json(dm({ body: '  Hello  ', attachments: [file] }))).toEqual({ status: 200, body: { stored: true, applicationId: 'a1', messageId: 'm1' } });
    expect(store.messages[0]).toMatchObject({ applicationId: 'a1', direction: 'FROM_APPLICANT', body: '  Hello  ', createdAt: new Date('2026-10-12T16:00:00.000Z'), dmChannelId: '100000000000000002', attachments: [file] });
    expect(store.enqueue).toHaveBeenCalledExactlyOnceWith('application.message.copy', { applicationId: 'a1', messageId: 'm1' }, expect.anything());
  });

  it('stores a repeat DM id once and queues once, with the same reply', async () => {
    seed();
    const first = await json(dm());
    expect(await json(dm())).toEqual(first);
    expect(store.messages).toHaveLength(1);
    expect(store.enqueue).toHaveBeenCalledTimes(1);
  });

  it('answers a DM id stored by a concurrent request with that message', async () => {
    seed();
    store.raceOnCreate = true;
    expect((await json(dm())).body).toEqual({ stored: true, applicationId: 'a1', messageId: 'raced' });
  });

  it('never treats an officer message id as the applicant DM', async () => {
    seed();
    store.messages.push({ id: 'o1', applicationId: 'a1', direction: 'TO_APPLICANT', dmMessageId: '100000000000000003', body: 'Hi', createdAt: created, attachments: [], dmChannelId: null });
    expect((await json(dm())).body).toEqual({ stored: false });
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('does not store a DM from someone with no application', async () => {
    expect(await json(dm())).toEqual({ status: 200, body: { stored: false } });
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('does not store a DM sent before the application was submitted', async () => {
    seed();
    expect((await json(dm({ createdAt: '2026-10-12T15:00:00.000Z' }))).body).toEqual({ stored: false });
    expect(store.messages).toHaveLength(0);
  });

  it('stores only the DM after a reopen, not one from the decided period', async () => {
    seed({ reopenedAt: new Date('2026-10-13T11:00:00Z') });
    expect((await json(dm({ dmMessageId: '100000000000000010', createdAt: '2026-10-13T10:00:00.000Z' }))).body).toEqual({ stored: false });
    expect((await json(dm({ dmMessageId: '100000000000000011', createdAt: '2026-10-13T11:30:00.000Z' }))).body).toMatchObject({ stored: true });
    expect(store.enqueue).toHaveBeenCalledTimes(1);
  });

  it('stores a DM sent while pending that arrives after the decision, but not one sent after it', async () => {
    seed({ status: 'ACCEPTED', decidedAt: new Date('2026-10-13T09:00:00Z') });
    expect((await json(dm({ dmMessageId: '100000000000000010', createdAt: '2026-10-13T08:00:00.000Z' }))).body).toMatchObject({ stored: true, applicationId: 'a1' });
    expect((await json(dm({ dmMessageId: '100000000000000011', createdAt: '2026-10-13T10:00:00.000Z' }))).body).toEqual({ stored: false });
  });

  it('uses the most recent application only', async () => {
    seed({ id: 'old', status: 'DECLINED', createdAt: new Date('2026-09-01T00:00:00Z'), decidedAt: new Date('2026-09-02T00:00:00Z') });
    seed({ id: 'new' });
    expect((await json(dm())).body).toMatchObject({ stored: true, applicationId: 'new' });
    // A DM from the old application's pending period still doesn't go to it.
    expect((await json(dm({ dmMessageId: '100000000000000010', createdAt: '2026-09-01T12:00:00.000Z' }))).body).toEqual({ stored: false });
  });

  it('accepts 4,000 characters and refuses 4,001', async () => {
    seed();
    expect((await json(dm({ body: 'a'.repeat(4000) }))).body).toMatchObject({ stored: true });
    const over = await json(dm({ dmMessageId: '100000000000000010', body: 'a'.repeat(4001) }));
    expect(over).toEqual({ status: 400, body: { reason: 'invalid', error: expect.any(String) } });
  });

  it('accepts an attachment-only DM and refuses an empty one', async () => {
    seed();
    const file = { id: '100000000000000009', filename: 'logs.zip', size: 40_000_000, spoiler: false };
    expect((await json(dm({ body: '', attachments: [file] }))).body).toMatchObject({ stored: true });
    expect(store.messages[0].body).toBe('');
    expect(await json(dm({ dmMessageId: '100000000000000010', body: '' }))).toMatchObject({ status: 400, body: { reason: 'invalid' } });
  });

  it('refuses eleven attachments', async () => {
    seed();
    const file = { id: '100000000000000009', filename: 'a.png', size: 1, spoiler: false };
    expect(await json(dm({ attachments: Array(11).fill(file) }))).toMatchObject({ status: 400, body: { reason: 'invalid' } });
    expect(store.messages).toHaveLength(0);
  });

  it.each([
    ['a missing discordId', { discordId: undefined }],
    ['a non-snowflake dmChannelId', { dmChannelId: 'abc' }],
    ['a non-snowflake dmMessageId', { dmMessageId: '12' }],
    ['an unparseable createdAt', { createdAt: 'not a date' }],
  ])('refuses %s with 400 invalid', async (_, over) => {
    seed();
    expect(await json(dm(over))).toMatchObject({ status: 400, body: { reason: 'invalid' } });
    expect(store.enqueue).not.toHaveBeenCalled();
  });
});
