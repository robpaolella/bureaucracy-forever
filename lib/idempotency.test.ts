import { beforeEach, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ findUnique: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { botRequest: store } }));
import { Prisma } from '@/lib/generated/prisma/client';
import { reply, withIdempotency } from './idempotency';

beforeEach(() => { vi.resetAllMocks(); });
const request = (key = '') => new Request('https://example.test', { headers: key ? { 'Idempotency-Key': key } : {} });

it.each([204, 205, 304])('returns and replays %s without a body', async (status) => {
  const handler = vi.fn(async () => reply(status, {}));
  for (const key of ['', 'interaction']) {
    const first = await withIdempotency(request(key), handler);
    expect(first.status).toBe(status);
    expect(await first.text()).toBe('');
    expect(first.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(store.create).toHaveBeenCalledWith({ data: { key: 'interaction', statusCode: status, body: {} } });
  store.findUnique.mockResolvedValue({ statusCode: status, body: {} });
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
  store.findUnique.mockResolvedValue({ statusCode: 409, body });
  const replay = await withIdempotency(request('interaction'), handler);
  expect(replay.status).toBe(409);
  expect(await replay.json()).toEqual(body);
  expect(replay.headers.get('Cache-Control')).toBe('private, no-store');
  expect(replay.headers.get('Idempotent-Replay')).toBe('true');
  expect(handler).toHaveBeenCalledTimes(1);
});

it('replays a bodyless winner when storing a duplicate key loses a race', async () => {
  store.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ statusCode: 204, body: {} });
  store.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }));
  const result = await withIdempotency(request('interaction'), async () => reply(204, {}));
  expect(result.status).toBe(204);
  expect(await result.text()).toBe('');
  expect(result.headers.get('Idempotent-Replay')).toBe('true');
});
