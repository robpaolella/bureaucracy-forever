import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/interviews', () => ({ getInterview: store.get }));

import { GET } from './route';

const call = (id: string, auth = true) =>
  GET(new Request(`https://example.test/api/bot/interviews/${id}`, { headers: auth ? { authorization: 'Bearer test-secret' } : {} }), { params: Promise.resolve({ id }) });

describe('GET /api/bot/interviews/:id', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.get.mockReset();
  });

  it('returns the read shape', async () => {
    store.get.mockResolvedValue({ id: 'i1', status: 'BOOKED' });
    const res = await call('i1');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'i1', status: 'BOOKED' });
  });

  it('404 { error } for an unknown or malformed id', async () => {
    store.get.mockResolvedValue(null);
    for (const id of ['nope', '%00', 'x'.repeat(500)]) {
      const res = await call(id);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Interview not found.' });
    }
  });

  it('refuses an unsigned request', async () => {
    expect((await call('i1', false)).status).toBe(401);
    expect(store.get).not.toHaveBeenCalled();
  });
});
