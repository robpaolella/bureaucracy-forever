import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  users: [] as { id: string; discordId: string; discordName: string; role: string }[],
  requests: new Map<string, { key: string; statusCode: number; body: unknown }>(),
  start: vi.fn(),
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
vi.mock('@/lib/interviews', () => ({ startInterview: store.start }));

import { POST } from './route';

const OFFICER = '100000000000000001';
const MEMBER = '100000000000000002';
const VIEW = { id: 'i1', status: 'AWAITING_TIMES' };

function call(body: unknown, { id = 'a1', headers = {} as Record<string, string>, auth = true } = {}) {
  const request = new Request(`https://example.test/api/bot/applications/${id}/interview`, {
    method: 'POST',
    headers: { ...(auth ? { authorization: 'Bearer test-secret' } : {}), 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

describe('POST /api/bot/applications/:id/interview', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.users = [
      { id: 'o', discordId: OFFICER, discordName: 'Boss', role: 'OFFICER' },
      { id: 'm', discordId: MEMBER, discordName: 'Raidy', role: 'MEMBER' },
    ];
    store.requests.clear();
    store.start.mockReset().mockResolvedValue({ ok: true, interview: VIEW });
  });

  it('refuses an unsigned or badly signed request', async () => {
    expect((await call({ byDiscordId: OFFICER }, { auth: false })).status).toBe(401);
    expect((await call({ byDiscordId: OFFICER }, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    expect(store.start).not.toHaveBeenCalled();
  });

  it('starts an interview: 201 { interview }', async () => {
    const res = await call({ byDiscordId: OFFICER });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ interview: VIEW });
    expect(store.start).toHaveBeenCalledWith('a1', { userId: 'o' }, { confirmSecond: false });
  });

  it('passes confirmSecond only when it is exactly true', async () => {
    await call({ byDiscordId: OFFICER, confirmSecond: true });
    expect(store.start).toHaveBeenLastCalledWith('a1', { userId: 'o' }, { confirmSecond: true });
    await call({ byDiscordId: OFFICER, confirmSecond: 'yes' });
    expect(store.start).toHaveBeenLastCalledWith('a1', { userId: 'o' }, { confirmSecond: false });
  });

  it('403 for a non-officer or unknown user, 400 for a malformed id or body', async () => {
    for (const by of [MEMBER, '100000000000000009']) {
      const res = await call({ byDiscordId: by });
      expect(res.status).toBe(403);
      expect((await res.json()).reason).toBe('forbidden');
    }
    expect((await call({ byDiscordId: 'nope' })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call('{not json')).status).toBe(400);
    expect(store.start).not.toHaveBeenCalled();
  });

  it('maps refusals to their status, reason and extras', async () => {
    store.start.mockResolvedValueOnce({ ok: false, status: 409, reason: 'not_pending', error: 'Decided.' });
    let res = await call({ byDiscordId: OFFICER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: 'not_pending', error: 'Decided.' });

    store.start.mockResolvedValueOnce({ ok: false, status: 409, reason: 'already_active', error: 'Busy.', interview: VIEW });
    res = await call({ byDiscordId: OFFICER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: 'already_active', error: 'Busy.', interview: VIEW });

    store.start.mockResolvedValueOnce({ ok: false, status: 409, reason: 'second_not_confirmed', error: 'Had one.', earlierDate: '2026-10-01T18:00:00.000Z' });
    res = await call({ byDiscordId: OFFICER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: 'second_not_confirmed', error: 'Had one.', earlierDate: '2026-10-01T18:00:00.000Z' });
  });

  it('404 { error } for an unknown application', async () => {
    store.start.mockResolvedValueOnce({ ok: false, status: 404, error: 'Application not found.' });
    const res = await call({ byDiscordId: OFFICER }, { id: 'zzz' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Application not found.' });
  });

  it('replays the first result for a repeated Idempotency-Key', async () => {
    const headers = { 'idempotency-key': 'k1' };
    const first = await call({ byDiscordId: OFFICER }, { headers });
    const again = await call({ byDiscordId: OFFICER }, { headers });
    expect(again.status).toBe(first.status);
    expect(await again.json()).toEqual({ interview: VIEW });
    expect(again.headers.get('Idempotent-Replay')).toBe('true');
    expect(store.start).toHaveBeenCalledTimes(1);
  });

  it('a new key after second_not_confirmed creates the second attempt', async () => {
    store.start.mockResolvedValueOnce({ ok: false, status: 409, reason: 'second_not_confirmed', error: 'Had one.', earlierDate: null });
    expect((await call({ byDiscordId: OFFICER }, { headers: { 'idempotency-key': 'k1' } })).status).toBe(409);
    const res = await call({ byDiscordId: OFFICER, confirmSecond: true }, { headers: { 'idempotency-key': 'k2' } });
    expect(res.status).toBe(201);
    expect(store.start).toHaveBeenCalledTimes(2);
  });
});
