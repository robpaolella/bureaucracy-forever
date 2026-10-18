import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; name: string; startsAt: Date; status: string; signups: { response: string | null; standing: string; user: { discordId: string } }[] };
const store = vi.hoisted(() => ({ roles: new Map<string, string>(), raids: [] as Row[] }));

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: async ({ where }: { where: { discordId: string } }) => (store.roles.has(where.discordId) ? { id: where.discordId, role: store.roles.get(where.discordId), characters: [] } : null) },
    raid: {
      findMany: async ({ where, orderBy, take }: { where: { startsAt: { gte: Date } }; orderBy: { startsAt: 'asc' }; take: number }) => {
        expect(orderBy).toEqual({ startsAt: 'asc' });
        return store.raids.filter((r) => r.startsAt >= where.startsAt.gte).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()).slice(0, take);
      },
      findUnique: async ({ where }: { where: { id: string } }) => store.raids.find((r) => r.id === where.id) ?? null,
    },
  },
}));

import { GET as LIST } from './route';
import { GET as SIGNUPS } from './[id]/signups/route';

const OFFICER = '100000000000000001';
const MEMBER = '100000000000000002';
const DAY = 24 * 60 * 60_000;
const raid = (id: string, days: number, status = 'SCHEDULED', signups: Row['signups'] = []): Row => ({ id, name: `Raid ${id}`, startsAt: new Date(Date.now() + days * DAY), status, signups });

const url = (path: string, by?: string) => `https://example.test/api/bot/raids${path}${by === undefined ? '' : `?byDiscordId=${by}`}`;
const get = (path: string, by?: string, secret = 'test-secret') => new Request(url(path, by), { headers: { authorization: `Bearer ${secret}` } });
const list = (by?: string, secret?: string) => LIST(get('', by, secret));
const signups = (id: string, by?: string, secret?: string) => SIGNUPS(get(`/${id}/signups`, by, secret), { params: Promise.resolve({ id }) });

describe('GET /api/bot/raids', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.roles = new Map([[OFFICER, 'OFFICER'], [MEMBER, 'MEMBER']]);
    store.raids = [];
  });

  it('lists raids from 7 days ago in start order, any status, and skips older ones', async () => {
    store.raids = [raid('later', 5), raid('old', -8, 'DONE'), raid('cancelled', 2, 'CANCELLED'), raid('done', -6, 'DONE')];
    const res = await list(OFFICER);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const { raids } = (await res.json()) as { raids: { id: string; name: string; startsAt: string; status: string }[] };
    expect(raids.map((r) => r.id)).toEqual(['done', 'cancelled', 'later']);
    expect(raids[1]).toEqual({ id: 'cancelled', name: 'Raid cancelled', startsAt: store.raids[2].startsAt.toISOString(), status: 'CANCELLED' });
  });

  it('returns at most 25, dropping the furthest-future', async () => {
    store.raids = Array.from({ length: 30 }, (_, i) => raid(`r${i}`, i));
    const { raids } = (await (await list(OFFICER)).json()) as { raids: { id: string }[] };
    expect(raids).toHaveLength(25);
    expect(raids[0].id).toBe('r0');
    expect(raids[24].id).toBe('r24');
  });

  it('returns an empty list when nothing qualifies', async () => {
    store.raids = [raid('old', -9)];
    expect(await (await list(OFFICER)).json()).toEqual({ raids: [] });
  });

  it('refuses a bad secret with 401, a missing or malformed id with 400, a non-officer with 403', async () => {
    expect((await list(OFFICER, 'wrong')).status).toBe(401);
    for (const by of [undefined, 'x', '']) {
      const res = await list(by);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ reason: 'invalid' });
    }
    for (const by of [MEMBER, '100000000000000009']) {
      const res = await list(by);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ reason: 'forbidden', error: 'Only officers can send broadcasts.' });
    }
  });
});

describe('GET /api/bot/raids/:id/signups', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.roles = new Map([[OFFICER, 'OFFICER'], [MEMBER, 'MEMBER']]);
    store.raids = [raid('r1', 3, 'SCHEDULED', [
      { response: 'ACCEPT', standing: 'ROSTER', user: { discordId: '200000000000000001' } },
      { response: 'TENTATIVE', standing: 'BENCH', user: { discordId: '200000000000000002' } },
      { response: 'ABSENT', standing: 'ROSTER', user: { discordId: '200000000000000003' } },
      { response: null, standing: 'ROSTER', user: { discordId: '200000000000000004' } },
    ])];
  });

  it('returns the raid and every sign-up row', async () => {
    const res = await signups('r1', OFFICER);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      raid: { id: 'r1', name: 'Raid r1', startsAt: store.raids[0].startsAt.toISOString(), status: 'SCHEDULED' },
      signups: [
        { discordId: '200000000000000001', response: 'ACCEPT', standing: 'ROSTER' },
        { discordId: '200000000000000002', response: 'TENTATIVE', standing: 'BENCH' },
        { discordId: '200000000000000003', response: 'ABSENT', standing: 'ROSTER' },
        { discordId: '200000000000000004', response: null, standing: 'ROSTER' },
      ],
    });
  });

  it('checks in order: bearer 401, id 400, officer 403, then unknown raid 404', async () => {
    expect((await signups('nope', OFFICER, 'wrong')).status).toBe(401);
    expect((await signups('nope')).status).toBe(400);
    expect((await signups('nope', 'abc')).status).toBe(400);
    for (const id of ['r1', 'nope']) {
      const res = await signups(id, MEMBER);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ reason: 'forbidden', error: 'Only officers can send broadcasts.' });
    }
    expect((await signups('r1', '100000000000000009')).status).toBe(403);
    const res = await signups('nope', OFFICER);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'No such raid.' });
  });
});
