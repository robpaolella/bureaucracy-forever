import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  users: [] as { id: string; discordId: string; discordName: string; role: string }[],
  requests: new Map<string, { key: string; statusCode: number; body: unknown }>(),
  fn: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: async ({ where }: { where: { discordId: string } }) => {
      const u = store.users.find((r) => r.discordId === where.discordId);
      return u ? { ...u, characters: [] } : null;
    } },
    botRequest: {
      findUnique: async ({ where }: { where: { key: string } }) => store.requests.get(where.key) ?? null,
      create: async ({ data }: { data: { key: string; statusCode: number; body: unknown } }) => { store.requests.set(data.key, data); },
    },
  },
}));
vi.mock('@/lib/interviews', () => ({ proposeTime: store.fn }));

import { POST } from './route';

const OFFICER = '100000000000000001';
const MEMBER = '100000000000000002';
const VIEW = { id: 'i1', status: 'BOOKED' };
const HEADERS = { 'content-type': 'application/json' };

function call(body: unknown, { id = 'i1', headers = {} as Record<string, string>, auth = true } = {}) {
  const request = new Request(`https://example.test/api/bot/interviews/${id}/propose`, {
    method: 'POST',
    headers: { ...(auth ? { authorization: 'Bearer test-secret' } : {}), ...HEADERS, ...headers },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}
const OK = { startsAt: '2026-10-20T19:00:00.000Z', byDiscordId: OFFICER };

describe('POST /api/bot/interviews/:id/propose', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.users = [
      { id: 'o', discordId: OFFICER, discordName: 'Boss', role: 'OFFICER' },
      { id: 'm', discordId: MEMBER, discordName: 'Raidy', role: 'MEMBER' },
    ];
    store.requests.clear();
    store.fn.mockReset().mockResolvedValue({ ok: true, interview: VIEW });
  });

  it('refuses an unsigned or badly signed request', async () => {
    expect((await call(OK, { auth: false })).status).toBe(401);
    expect((await call(OK, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    expect(store.fn).not.toHaveBeenCalled();
  });

  it('replays the first result for a repeated Idempotency-Key', async () => {
    const headers = { 'idempotency-key': 'k1' };
    await call(OK, { headers });
    const again = await call(OK, { headers });
    expect(await again.json()).toEqual(VIEW);
    expect(again.headers.get('Idempotent-Replay')).toBe('true');
    expect(store.fn).toHaveBeenCalledTimes(1);
  });

  it('404 for an unknown interview, never a 500 for bad input', async () => {
    store.fn.mockResolvedValueOnce({ ok: false, status: 404, error: 'Interview not found.' });
    const res = await call(OK, { id: 'zzz' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Interview not found.' });
    store.fn.mockResolvedValueOnce({ ok: false, status: 400, reason: 'invalid', error: 'Send a start time.' });
    const bad = await call(OK);
    expect(bad.status).toBe(400);
    expect((await bad.json()).reason).toBe('invalid');
  });

  it('403 for a non-officer, 400 for a malformed byDiscordId', async () => {
    const res = await call({ ...OK, byDiscordId: MEMBER });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('forbidden');
    expect((await call({ ...OK, byDiscordId: 'nope' })).status).toBe(400);
    expect(store.fn).not.toHaveBeenCalled();
  });

  it('proposes: 200 with the read shape', async () => {
    const res = await call(OK);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VIEW);
    expect(store.fn).toHaveBeenCalledWith('i1', { userId: 'o' }, OK.startsAt);
  });

  it('400 out_of_range, 409 wrong_status', async () => {
    store.fn.mockResolvedValueOnce({ ok: false, status: 400, reason: 'out_of_range', error: 'Too far.' });
    let res = await call(OK);
    expect(res.status).toBe(400);
    expect((await res.json()).reason).toBe('out_of_range');
    store.fn.mockResolvedValueOnce({ ok: false, status: 409, reason: 'wrong_status', error: 'Already proposed.' });
    res = await call(OK);
    expect(res.status).toBe(409);
    expect((await res.json()).reason).toBe('wrong_status');
  });
});
