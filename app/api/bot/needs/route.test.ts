import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ roles: new Map<string, string>(), rows: [] as { wowClass: string; spec: string; status: string }[], setNeed: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: { user: { findUnique: async ({ where }: { where: { discordId: string } }) => (store.roles.has(where.discordId) ? { id: where.discordId, role: store.roles.get(where.discordId), characters: [] } : null) } },
}));
vi.mock('@/lib/class-needs-data', () => ({ readNeedRowsUncached: async () => store.rows, setClassNeed: store.setNeed }));

import { GET, PUT } from './route';

const OFFICER = '100000000000000001';
const MEMBER = '100000000000000002';
const STRANGER = '100000000000000009';

const request = (method: string, body?: Record<string, unknown>, secret = 'test-secret') =>
  new Request('https://example.test/api/bot/needs', { method, headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

describe('/api/bot/needs', () => {
  beforeEach(() => {
    process.env.BOT_SHARED_SECRET = 'test-secret';
    store.roles = new Map([[OFFICER, 'OFFICER'], [MEMBER, 'MEMBER']]);
    store.rows = [{ wowClass: 'warrior', spec: 'Protection', status: 'high' }];
    store.setNeed.mockReset().mockResolvedValue(undefined);
  });

  it('needs the bot secret', async () => {
    expect((await GET(request('GET', undefined, 'wrong'))).status).toBe(401);
    expect((await PUT(request('PUT', { wowClass: 'warrior', spec: 'Arms', status: 'high', byDiscordId: OFFICER }, 'wrong'))).status).toBe(401);
  });

  it('lists every class and spec, uncached', async () => {
    const res = await GET(request('GET'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = (await res.json()) as { statuses: string[]; classes: { key: string; label: string; specs: { name: string; status: string }[] }[] };
    expect(body.statuses).toEqual(['high', 'medium', 'closed']);
    expect(body.classes[0]).toEqual({ key: 'warrior', label: 'Warrior', specs: [{ name: 'Protection', status: 'high' }, { name: 'Fury', status: 'closed' }, { name: 'Arms', status: 'closed' }] });
  });

  it('lets an officer set a spec, through the shared write', async () => {
    const res = await PUT(request('PUT', { wowClass: 'warrior', spec: 'Arms', status: 'medium', byDiscordId: OFFICER }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wowClass: 'warrior', spec: 'Arms', status: 'medium' });
    expect(store.setNeed).toHaveBeenCalledWith({ wowClass: 'warrior', spec: 'Arms', status: 'medium' });
  });

  it('refuses anyone but an officer with 403', async () => {
    for (const by of [MEMBER, STRANGER]) {
      const res = await PUT(request('PUT', { wowClass: 'warrior', spec: 'Arms', status: 'high', byDiscordId: by }));
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Only officers set recruitment needs.' });
    }
    expect(store.setNeed).not.toHaveBeenCalled();
  });

  it('refuses a bad id, class, spec or status with 400', async () => {
    const bad = [
      { wowClass: 'warrior', spec: 'Arms', status: 'high', byDiscordId: 'x' },
      { wowClass: 'monk', spec: 'Arms', status: 'high', byDiscordId: OFFICER },
      { wowClass: 'warrior', spec: 'Holy', status: 'high', byDiscordId: OFFICER },
      { wowClass: 'warrior', spec: 'Arms', status: 'urgent', byDiscordId: OFFICER },
    ];
    for (const body of bad) expect((await PUT(request('PUT', body))).status).toBe(400);
    expect(store.setNeed).not.toHaveBeenCalled();
  });
});
