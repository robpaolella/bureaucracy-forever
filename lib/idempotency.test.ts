import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type Row = { key: string; statusCode: number; body: unknown; createdAt: Date };
type Where = Partial<Row>;
const rows = vi.hoisted(() => new Map<string, { key: string; statusCode: number; body: unknown; createdAt: Date }>());
const matches = (row: Row | undefined, where: Where): row is Row =>
  !!row && Object.entries(where).every(([k, v]) => (v instanceof Date ? (row[k as keyof Row] as Date).getTime() === v.getTime() : row[k as keyof Row] === v));
const store = vi.hoisted(() => ({
  findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: { botRequest: store } }));
import { Prisma } from '@/lib/generated/prisma/client';
import { CLAIM_LIFETIME_MS, reply, withIdempotency, WAIT_MS, type Complete } from './idempotency';

beforeEach(() => {
  rows.clear();
  store.findUnique.mockReset().mockImplementation(async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null);
  store.create.mockReset().mockImplementation(async ({ data }: { data: Row }) => {
    if (rows.has(data.key)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
    rows.set(data.key, { ...data, createdAt: data.createdAt ?? new Date() });
    return rows.get(data.key);
  });
  store.updateMany.mockReset().mockImplementation(async ({ where, data }: { where: Where; data: Partial<Row> }) => {
    const row = rows.get(where.key!);
    if (!matches(row, where)) return { count: 0 };
    Object.assign(row, data);
    return { count: 1 };
  });
  store.deleteMany.mockReset().mockImplementation(async ({ where }: { where: Where }) => {
    if (!matches(rows.get(where.key!), where)) return { count: 0 };
    rows.delete(where.key!);
    return { count: 1 };
  });
});
afterEach(() => { vi.useRealTimers(); });
const request = (key = '') => new Request('https://example.test', { headers: key ? { 'Idempotency-Key': key } : {} });

it.each([204, 205, 304])('returns and replays %s without a body', async (status) => {
  const handler = vi.fn(async () => reply(status, {}));
  for (const key of ['', 'interaction']) {
    const first = await withIdempotency(request(key), handler);
    expect(first.status).toBe(status);
    expect(await first.text()).toBe('');
    expect(first.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(rows.get('interaction')).toMatchObject({ statusCode: status, body: {} });
  handler.mockClear();
  const replay = await withIdempotency(request('interaction'), handler);
  expect(replay.status).toBe(status);
  expect(await replay.text()).toBe('');
  expect(replay.headers.get('Idempotent-Replay')).toBe('true');
  expect(handler).not.toHaveBeenCalled();
});

it('keeps JSON status, body and headers unchanged for ordinary responses and replay', async () => {
  const body = { reason: 'limit', error: 'Too many.' };
  const handler = vi.fn(async () => reply(409, body));
  const first = await withIdempotency(request('interaction'), handler);
  expect(first.status).toBe(409);
  expect(await first.json()).toEqual(body);
  expect(first.headers.get('Idempotent-Replay')).toBeNull();
  const replay = await withIdempotency(request('interaction'), handler);
  expect(replay.status).toBe(409);
  expect(await replay.json()).toEqual(body);
  expect(replay.headers.get('Cache-Control')).toBe('private, no-store');
  expect(replay.headers.get('Idempotent-Replay')).toBe('true');
  expect(handler).toHaveBeenCalledTimes(1);
});

it('runs without a key every time and stores nothing', async () => {
  const handler = vi.fn(async () => reply(200, { ok: true }));
  await withIdempotency(request(), handler);
  await withIdempotency(request(), handler);
  expect(handler).toHaveBeenCalledTimes(2);
  expect(store.create).not.toHaveBeenCalled();
});

it('claims the key before the handler runs; a concurrent repeat waits and replays the winner', async () => {
  let finish!: () => void;
  const handler = vi.fn(async () => {
    expect(rows.get('interaction')).toMatchObject({ statusCode: 0 });
    await new Promise<void>((resolve) => { finish = resolve; });
    return reply(201, { id: 'winner' });
  });
  const first = withIdempotency(request('interaction'), handler);
  await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  const second = withIdempotency(request('interaction'), handler);
  await new Promise((resolve) => setTimeout(resolve, 300));
  finish();
  const [a, b] = await Promise.all([first, second]);
  expect(handler).toHaveBeenCalledTimes(1);
  expect([a.status, await a.json()]).toEqual([201, { id: 'winner' }]);
  expect([b.status, await b.json()]).toEqual([201, { id: 'winner' }]);
  expect(b.headers.get('Idempotent-Replay')).toBe('true');
});

it.each([
  ['throws', async () => { throw new Error('boom'); }],
  ['returns a 5xx', async () => reply(503, { error: 'Down.' })],
])('a first attempt that %s releases the key so a retry runs', async (how, fail) => {
  const first = withIdempotency(request('interaction'), fail);
  if (how === 'throws') await expect(first).rejects.toThrow('boom');
  else expect((await first).status).toBe(503);
  expect(rows.has('interaction')).toBe(false);
  const retry = vi.fn(async () => reply(200, { ok: true }));
  const second = await withIdempotency(request('interaction'), retry);
  expect(retry).toHaveBeenCalledTimes(1);
  expect(second.status).toBe(200);
  expect(second.headers.get('Idempotent-Replay')).toBeNull();
});

it('takes over a claim older than its lifetime', async () => {
  rows.set('interaction', { key: 'interaction', statusCode: 0, body: {}, createdAt: new Date(Date.now() - CLAIM_LIFETIME_MS - 1000) });
  const handler = vi.fn(async () => reply(200, { ok: true }));
  const result = await withIdempotency(request('interaction'), handler);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(result.status).toBe(200);
  expect(rows.get('interaction')).toMatchObject({ statusCode: 200, body: { ok: true } });
});

it('only one of two retries takes over an expired claim', async () => {
  rows.set('interaction', { key: 'interaction', statusCode: 0, body: {}, createdAt: new Date(Date.now() - CLAIM_LIFETIME_MS - 1000) });
  let finish!: () => void;
  const handler = vi.fn(async () => { await new Promise<void>((resolve) => { finish = resolve; }); return reply(200, { ok: true }); });
  const results = Promise.all([withIdempotency(request('interaction'), handler), withIdempotency(request('interaction'), handler)]);
  await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 300));
  finish();
  expect((await results).map((r) => r.status)).toEqual([200, 200]);
  expect(handler).toHaveBeenCalledTimes(1);
});

it('a repeat still waiting after the limit gets 409 in_progress and never runs the handler', async () => {
  rows.set('interaction', { key: 'interaction', statusCode: 0, body: {}, createdAt: new Date() });
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
  const handler = vi.fn(async () => reply(200, {}));
  const pending = withIdempotency(request('interaction'), handler);
  await vi.advanceTimersByTimeAsync(WAIT_MS + 1000);
  const result = await pending;
  expect(result.status).toBe(409);
  expect(await result.json()).toEqual({ reason: 'in_progress', error: expect.any(String) });
  expect(result.headers.get('Idempotent-Replay')).toBeNull();
  expect(handler).not.toHaveBeenCalled();
  expect(rows.get('interaction')).toMatchObject({ statusCode: 0 });
});

// A stand-in transaction client over the same rows; `rollback` undoes what it wrote.
const transaction = () => {
  const before = new Map([...rows].map(([k, row]) => [k, { ...row }]));
  return {
    tx: { botRequest: store } as unknown as Parameters<Complete>[0],
    rollback: () => { rows.clear(); for (const [k, row] of before) rows.set(k, row); },
  };
};

it('complete stores the reply through the transaction, and the later save changes nothing', async () => {
  const handler = vi.fn(async (complete: Complete) => {
    const r = await complete(transaction().tx, reply(201, { id: 'm1' }));
    expect(rows.get('interaction')).toMatchObject({ statusCode: 201, body: { id: 'm1' } });
    return r;
  });
  const first = await withIdempotency(request('interaction'), handler);
  expect([first.status, await first.json()]).toEqual([201, { id: 'm1' }]);
  expect(store.updateMany).toHaveBeenCalledTimes(2);
  expect(await store.updateMany.mock.results[1].value).toEqual({ count: 0 });
  const replay = await withIdempotency(request('interaction'), handler);
  expect(replay.headers.get('Idempotent-Replay')).toBe('true');
  expect(handler).toHaveBeenCalledTimes(1);
});

it('a claim completed in a transaction is replayed, not run again, after its lifetime', async () => {
  const handler = vi.fn(async (complete: Complete) => complete(transaction().tx, reply(201, { id: 'm1' })));
  await withIdempotency(request('interaction'), handler);
  rows.get('interaction')!.createdAt = new Date(Date.now() - CLAIM_LIFETIME_MS - 1000);
  const late = await withIdempotency(request('interaction'), handler);
  expect([late.status, late.headers.get('Idempotent-Replay')]).toEqual([201, 'true']);
  expect(handler).toHaveBeenCalledTimes(1);
});

it('complete without a key stores nothing and returns the reply', async () => {
  const result = await withIdempotency(request(), async (complete) => complete(transaction().tx, reply(201, { id: 'm1' })));
  expect([result.status, await result.json()]).toEqual([201, { id: 'm1' }]);
  expect(store.create).not.toHaveBeenCalled();
  expect(store.updateMany).not.toHaveBeenCalled();
});

it('complete stores nothing for a 5xx, and the claim is released', async () => {
  const result = await withIdempotency(request('interaction'), async (complete) => complete(transaction().tx, reply(503, { error: 'Down.' })));
  expect(result.status).toBe(503);
  expect(rows.has('interaction')).toBe(false);
});

it('when the transaction rolls back after complete, the reply the handler returns is stored instead', async () => {
  const result = await withIdempotency(request('interaction'), async (complete) => {
    const { tx, rollback } = transaction();
    await complete(tx, reply(201, { id: 'm1' }));
    rollback();
    return reply(200, { id: 'raced' });
  });
  expect(result.status).toBe(200);
  expect(rows.get('interaction')).toMatchObject({ statusCode: 200, body: { id: 'raced' } });
});

it('complete throws, so the transaction rolls back, once another retry has taken the claim over', async () => {
  const handler = async (complete: Complete) => {
    rows.get('interaction')!.createdAt = new Date(0); // another retry took the expired claim over
    return complete(transaction().tx, reply(201, { id: 'm1' }));
  };
  await expect(withIdempotency(request('interaction'), handler)).rejects.toThrow('no longer claimed');
  expect(rows.get('interaction')).toMatchObject({ statusCode: 0, createdAt: new Date(0) });
});
