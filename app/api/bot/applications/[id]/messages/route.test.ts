import { beforeEach, describe, expect, it, vi } from 'vitest';

type Msg = { id: string; applicationId: string; direction: string; authorUserId: string; body: string; status: string };
type BotRequest = { key: string; statusCode: number; body: unknown; createdAt: Date };
const store = vi.hoisted(() => ({
  requests: new Map<string, BotRequest>(),
  crashAfterCommit: false,
  apps: {} as Record<string, string>,
  users: {} as Record<string, { id: string; role: string }>,
  messages: [] as Msg[],
  jobs: [] as unknown[][],
  failRead: false,
  enqueue: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/outbox', () => ({ enqueue: store.enqueue }));
vi.mock('../../../messages/[id]/message', () => ({
  readMessage: async (id: string, client: unknown) => {
    if (!client) throw new Error('read outside the transaction');
    if (store.failRead) {
      store.failRead = false;
      throw new Error('read failed');
    }
    return { ...store.messages.find((m) => m.id === id), shape: 'GET /messages/:id' };
  },
}));
vi.mock('@/lib/db', async () => {
  const { Prisma } = await import('@/lib/generated/prisma/client');
  // Matches every field of `where`, as Prisma does.
  const matches = (row: BotRequest | undefined, where: Partial<BotRequest>): row is BotRequest =>
    !!row && Object.entries(where).every(([k, v]) => (v instanceof Date ? (row[k as keyof BotRequest] as Date).getTime() === v.getTime() : row[k as keyof BotRequest] === v));
  const botRequest = {
    create: async ({ data }: { data: BotRequest }) => {
      if (store.requests.has(data.key)) throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });
      store.requests.set(data.key, { ...data });
    },
    findUnique: async ({ where }: { where: { key: string } }) => store.requests.get(where.key) ?? null,
    updateMany: async ({ where, data }: { where: Partial<BotRequest> & { key: string }; data: Partial<BotRequest> }) => {
      const row = store.requests.get(where.key);
      if (!matches(row, where)) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
    deleteMany: async ({ where }: { where: Partial<BotRequest> & { key: string } }) =>
      ({ count: matches(store.requests.get(where.key), where) && store.requests.delete(where.key) ? 1 : 0 }),
  };
  // Outside a transaction: the server dies right after the transaction commits.
  const crashable = Object.fromEntries(Object.entries(botRequest).map(([name, fn]) => [name, async (args: never) => {
    if (store.crashAfterCommit && (name === 'updateMany' || name === 'deleteMany')) throw new Error('crashed');
    return (fn as (a: never) => unknown)(args);
  }]));
  const tx = {
    botRequest,
    application: { findUnique: async ({ where }: { where: { id: string } }) => (where.id in store.apps ? { id: where.id, status: store.apps[where.id] } : null) },
    user: { findUnique: async ({ where }: { where: { discordId: string } }) => store.users[where.discordId] ?? null },
    applicantMessage: {
      create: async ({ data }: { data: Omit<Msg, 'id'> }) => {
        const row = { ...data, id: `m${store.messages.length + 1}` };
        store.messages.push(row);
        return { id: row.id };
      },
    },
  };
  // Rolls the store back when the callback throws, as a real transaction would.
  const $transaction = async (fn: (t: typeof tx) => unknown) => {
    const before = { messages: store.messages.length, jobs: store.jobs.length, requests: structuredClone(store.requests) };
    try {
      return await fn(tx);
    } catch (e) {
      store.messages.length = before.messages;
      store.jobs.length = before.jobs;
      store.requests = before.requests;
      throw e;
    }
  };
  return { db: { ...tx, botRequest: crashable, $transaction } };
});

import { CLAIM_LIFETIME_MS } from '@/lib/idempotency';
import { NOT_PENDING_ERROR } from '@/lib/relay';
import { POST } from './route';

const JAINA = '200000000000000001';
const GRUNT = '200000000000000002';
const send = async (body: unknown, { id = 'a1', key, secret = 'test-secret' }: { id?: string; key?: string; secret?: string | null } = {}) => {
  const headers = { 'content-type': 'application/json', ...(secret ? { authorization: `Bearer ${secret}` } : {}), ...(key ? { 'idempotency-key': key } : {}) };
  const res = await POST(new Request('https://example.test/x', { method: 'POST', headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  return { status: res.status, body: await res.json() };
};
const msg = (body: unknown, by = JAINA) => ({ byDiscordId: by, body });

describe('POST /api/bot/applications/:id/messages', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.apps = { a1: 'PENDING' };
    store.users = { [JAINA]: { id: 'u1', role: 'OFFICER' }, [GRUNT]: { id: 'u2', role: 'MEMBER' } };
    store.messages = [];
    store.jobs = [];
    store.failRead = false;
    store.requests = new Map();
    store.crashAfterCommit = false;
    store.enqueue.mockReset();
    store.enqueue.mockImplementation(async (...args: unknown[]) => { store.jobs.push(args); });
  });

  it('refuses a request without the bot secret', async () => {
    expect((await send(msg('Hi'), { secret: null })).status).toBe(401);
    expect(store.messages).toHaveLength(0);
  });

  it('stores a queued officer message, queues its send and answers with the message', async () => {
    const res = await send(msg('  When can you interview?  '));
    expect(res).toEqual({ status: 201, body: { message: expect.objectContaining({ id: 'm1', status: 'QUEUED', shape: 'GET /messages/:id' }) } });
    expect(store.messages).toEqual([{ id: 'm1', applicationId: 'a1', direction: 'TO_APPLICANT', authorUserId: 'u1', body: 'When can you interview?', status: 'QUEUED' }]);
    expect(store.enqueue).toHaveBeenCalledExactlyOnceWith('application.message.send', { applicationId: 'a1', messageId: 'm1' }, expect.anything());
  });

  it('refuses anyone who is not an officer with 403 forbidden', async () => {
    for (const by of [GRUNT, '200000000000000009']) {
      const res = await send(msg('Hi', by));
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ reason: 'forbidden', error: expect.any(String) });
    }
    expect(store.messages).toHaveLength(0);
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('404s an unknown application', async () => {
    expect(await send(msg('Hi'), { id: 'nope' })).toEqual({ status: 404, body: { error: expect.any(String) } });
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('refuses a decided application with the approved not_pending error', async () => {
    for (const status of ['ACCEPTED', 'DECLINED']) {
      store.apps.a1 = status;
      expect(await send(msg('Hi'))).toEqual({ status: 409, body: { reason: 'not_pending', error: NOT_PENDING_ERROR } });
    }
    expect(NOT_PENDING_ERROR).toBe("This application has been decided, so I can't pass messages on. DM them yourself if you need to.");
    expect(store.enqueue).not.toHaveBeenCalled();
  });

  it('sends again once the application is reopened (pending again)', async () => {
    store.apps.a1 = 'DECLINED';
    expect((await send(msg('Hi'))).status).toBe(409);
    store.apps.a1 = 'PENDING';
    expect((await send(msg('Hi'))).status).toBe(201);
    expect(store.enqueue).toHaveBeenCalledTimes(1);
  });

  it('takes 1 and 1,500 characters and refuses empty, whitespace-only and 1,501', async () => {
    expect((await send(msg('a'))).status).toBe(201);
    expect((await send(msg('a'.repeat(1500)))).status).toBe(201);
    for (const body of ['', '   \n ', 'a'.repeat(1501), undefined]) {
      const res = await send(msg(body));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ reason: 'invalid', error: expect.any(String) });
    }
    expect(store.messages).toHaveLength(2);
    expect(store.enqueue).toHaveBeenCalledTimes(2);
  });

  it('stores and queues once for the same Idempotency-Key, replaying the reply', async () => {
    const first = await send(msg('Hi'), { key: 'interaction-1' });
    expect(await send(msg('Hi'), { key: 'interaction-1' })).toEqual(first);
    expect(store.messages).toHaveLength(1);
    expect(store.enqueue).toHaveBeenCalledTimes(1);
    expect((await send(msg('Hi'), { key: 'interaction-2' })).status).toBe(201);
    expect(store.messages).toHaveLength(2);
  });

  it('rolls the message back when its reply cannot be read, so a retry under the same key sends once', async () => {
    store.failRead = true;
    await expect(send(msg('Hi'), { key: 'interaction-retry' })).rejects.toThrow('read failed');
    expect(store.messages).toHaveLength(0);
    expect(store.jobs).toHaveLength(0);
    expect(store.requests.has('interaction-retry')).toBe(false);
    expect((await send(msg('Hi'), { key: 'interaction-retry' })).status).toBe(201);
    expect(store.messages).toHaveLength(1);
    expect(store.jobs).toEqual([['application.message.send', { applicationId: 'a1', messageId: 'm1' }, expect.anything()]]);
  });

  it('stores the reply with the message, so a crash after the commit cannot DM twice on a late same-key retry', async () => {
    store.crashAfterCommit = true;
    await expect(send(msg('Hi'), { key: 'interaction-late' })).rejects.toThrow('crashed');
    store.crashAfterCommit = false;
    expect(store.messages).toHaveLength(1);
    expect(store.jobs).toHaveLength(1);
    const saved = store.requests.get('interaction-late')!;
    expect(saved).toMatchObject({ statusCode: 201, body: { message: expect.objectContaining({ id: 'm1' }) } });
    saved.createdAt = new Date(Date.now() - CLAIM_LIFETIME_MS - 60_000);
    const headers = { 'content-type': 'application/json', authorization: 'Bearer test-secret', 'idempotency-key': 'interaction-late' };
    const retry = await POST(new Request('https://example.test/x', { method: 'POST', headers, body: JSON.stringify(msg('Hi')) }), { params: Promise.resolve({ id: 'a1' }) });
    expect(retry.status).toBe(201);
    expect(retry.headers.get('Idempotent-Replay')).toBe('true');
    expect(await retry.json()).toEqual({ message: expect.objectContaining({ id: 'm1', status: 'QUEUED' }) });
    expect(store.messages).toHaveLength(1);
    expect(store.jobs).toHaveLength(1);
  });
});
