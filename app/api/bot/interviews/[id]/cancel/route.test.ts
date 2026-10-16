import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({
  users: [] as { id: string; discordId: string; discordName: string; role: string }[],
  requests: new Map<string, { key: string; statusCode: number; body: unknown }>(),
  cancel: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: async ({ where }: { where: { discordId: string } }) => {
      const u = store.users.find((r) => r.discordId === where.discordId);
      return u ? { ...u, characters: [] } : null;
    } },
    botRequest: {
      findUnique: async ({ where }: { where: { key: string } }) => store.requests.get(where.key) ?? null,
      create: async ({ data }: { data: { key: string; statusCode: number; body: unknown } }) => {
        if (store.requests.has(data.key)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
        store.requests.set(data.key, data);
      },
      updateMany: async ({ where, data }: { where: { key: string }; data: { statusCode: number; body: unknown } }) => {
        store.requests.set(where.key, { ...store.requests.get(where.key)!, ...data });
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { key: string } }) => ({ count: Number(store.requests.delete(where.key)) }),
    },
  },
}));
vi.mock('@/lib/interviews', () => ({ cancelInterview: store.cancel }));

import { Prisma } from '@/lib/generated/prisma/client';
import { POST } from './route';

const OFFICER = '100000000000000001';
const MEMBER = '100000000000000002';
const VIEW = { id: 'i1', status: 'CANCELLED' };

function call(body: unknown, { id = 'i1', headers = {} as Record<string, string>, auth = true } = {}) {
  const request = new Request(`https://example.test/api/bot/interviews/${id}/cancel`, {
    method: 'POST',
    headers: { ...(auth ? { authorization: 'Bearer test-secret' } : {}), 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

describe('POST /api/bot/interviews/:id/cancel', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.users = [
      { id: 'o', discordId: OFFICER, discordName: 'Boss', role: 'OFFICER' },
      { id: 'm', discordId: MEMBER, discordName: 'Raidy', role: 'MEMBER' },
    ];
    store.requests.clear();
    store.cancel.mockReset().mockResolvedValue({ ok: true, interview: VIEW });
  });

  it('refuses an unsigned or badly signed request', async () => {
    expect((await call({ byDiscordId: OFFICER }, { auth: false })).status).toBe(401);
    expect((await call({ byDiscordId: OFFICER }, { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
    expect(store.cancel).not.toHaveBeenCalled();
  });

  it('cancels: 200 with the read shape', async () => {
    const res = await call({ byDiscordId: OFFICER });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VIEW);
    expect(store.cancel).toHaveBeenCalledWith('i1', { userId: 'o' });
  });

  it('403 for a non-officer, 400 for a malformed byDiscordId', async () => {
    const res = await call({ byDiscordId: MEMBER });
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe('forbidden');
    expect((await call({ byDiscordId: 'nope' })).status).toBe(400);
    expect(store.cancel).not.toHaveBeenCalled();
  });

  it('409 not_active once ended, 404 for an unknown interview', async () => {
    store.cancel.mockResolvedValueOnce({ ok: false, status: 409, reason: 'not_active', error: 'This interview was cancelled.' });
    let res = await call({ byDiscordId: OFFICER });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: 'not_active', error: 'This interview was cancelled.' });
    store.cancel.mockResolvedValueOnce({ ok: false, status: 404, error: 'Interview not found.' });
    res = await call({ byDiscordId: OFFICER }, { id: 'zzz' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Interview not found.' });
  });

  it('replays the first result for a repeated Idempotency-Key', async () => {
    const headers = { 'idempotency-key': 'k1' };
    await call({ byDiscordId: OFFICER }, { headers });
    const again = await call({ byDiscordId: OFFICER }, { headers });
    expect(await again.json()).toEqual(VIEW);
    expect(again.headers.get('Idempotent-Replay')).toBe('true');
    expect(store.cancel).toHaveBeenCalledTimes(1);
  });
});
