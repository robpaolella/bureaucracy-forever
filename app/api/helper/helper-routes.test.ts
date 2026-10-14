import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: true,
  verify: vi.fn(),
  user: vi.fn(),
  raid: vi.fn(),
  raids: vi.fn(),
  load: vi.fn(),
  release: vi.fn(),
}));

vi.mock('@/lib/flags', () => ({ helperEnabled: () => mocks.enabled }));
vi.mock('@/lib/helper-keys', () => ({ verifyHelperKey: mocks.verify, recordHelperKeyUse: async () => {} }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: mocks.user }, raid: { findUnique: mocks.raid, findMany: mocks.raids } } }));
vi.mock('@/lib/addon-release', async (real) => ({ ...(await real<typeof import('@/lib/addon-release')>()), getAddonRelease: mocks.release }));
vi.mock('@/lib/addon-snapshot', async (real) => ({ ...(await real<typeof import('@/lib/addon-snapshot')>()), loadSnapshot: mocks.load }));

import { addonForSnapshot } from '@/lib/addon-release';
import { buildSnapshot } from '@/lib/addon-snapshot';
import { GET as me } from './me/route';
import { GET as raids } from './raids/route';
import { GET as snapshot } from './raids/[raid]/snapshot/route';

let n = 0;
let ip = '';
const request = (path: string) =>
  new Request(`https://example.test/api/helper/${path}`, { headers: { authorization: `Bearer bfh_${'a'.repeat(43)}`, 'x-real-ip': ip } });
const getSnapshot = (raid: string) => snapshot(request(`raids/${raid}/snapshot`), { params: Promise.resolve({ raid }) });

beforeEach(() => {
  vi.clearAllMocks();
  n += 1;
  ip = `192.0.2.${n}`;
  mocks.enabled = true;
  mocks.verify.mockResolvedValue({ ok: true, userId: 'u1', keyId: `rk${n}` });
  mocks.user.mockResolvedValue({ discordName: 'Sample Officer' });
  mocks.release.mockResolvedValue({ status: 'unreachable' });
});

describe('the helper routes share the guard', () => {
  const calls = [['me', () => me(request('me'))], ['raids', () => raids(request('raids'))], ['snapshot', () => getSnapshot('r1')]] as const;

  it.each(calls)('%s refuses while switched off', async (_name, call) => {
    mocks.enabled = false;
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('helper-off');
  });

  it.each(calls)('%s refuses a bad, revoked or other-site key with 401', async (_name, call) => {
    mocks.verify.mockResolvedValue({ ok: false, status: 401 });
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'bad-key', error: expect.any(String) });
  });

  it.each(calls)('%s refuses a former officer with 403', async (_name, call) => {
    mocks.verify.mockResolvedValue({ ok: false, status: 403 });
    expect((await call()).status).toBe(403);
  });
});

describe('GET /api/helper/me', () => {
  it('answers the officer’s Discord name, the environment, the formats and the add-on', async () => {
    const res = await me(request('me'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      officer: 'Sample Officer',
      env: 'production',
      formatVersions: [1],
      addon: { version: '', url: 'https://github.com/robpaolella/bureaucracy-forever-addon/releases/latest' },
    });
    expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u1' } }));
  });

  it('reports the latest add-on release exactly as the snapshot carries it', async () => {
    const found = { status: 'release', stale: false, release: { version: '1.2.0', publishedAt: '2026-10-14T00:00:00.000Z', downloadUrl: 'https://example.test/addon-1.2.0.zip' } } as const;
    mocks.release.mockResolvedValue(found);
    const body = await (await me(request('me'))).json();
    expect(body.addon).toEqual({ version: '1.2.0', url: 'https://example.test/addon-1.2.0.zip' });
    expect(body.addon).toEqual(addonForSnapshot(found));
  });

  it('refuses a key whose owner disappeared after the check', async () => {
    mocks.user.mockResolvedValue(null);
    expect((await me(request('me'))).status).toBe(401);
  });
});

describe('GET /api/helper/raids', () => {
  it('lists raids under way or within 12 hours, soonest first, with their loot-table flag', async () => {
    const now = Date.now();
    const at = (h: number) => new Date(now + h * 3_600_000);
    const tier = (items: boolean) => ({ lootBosses: items ? [{ id: 'b1' }] : [] });
    mocks.raids.mockResolvedValue([
      { id: 'cmraid00later', name: 'Later', startsAt: at(6), durationMin: 180, cancelledAt: null, template: tier(true) },
      { id: 'cmraid00under', name: 'Under way', startsAt: at(-1), durationMin: 180, cancelledAt: null, template: null },
      { id: 'cmraid00ended', name: 'Ended', startsAt: at(-4), durationMin: 180, cancelledAt: null, template: tier(true) },
    ]);
    const res = await raids(request('raids'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.map((r: { id: string; hasLootTable: boolean }) => [r.id, r.hasLootTable])).toEqual([['cmraid00under', false], ['cmraid00later', true]]);
    expect(body[0]).toEqual({ id: 'cmraid00under', code: 'PUNDER', name: 'Under way', startsAt: Math.floor(at(-1).getTime() / 1000), durationMin: 180, hasLootTable: false });
    const where = mocks.raids.mock.calls[0][0].where;
    expect(where.cancelledAt).toBeNull();
    expect(where.startsAt.lte.getTime()).toBeGreaterThanOrEqual(now + 12 * 3_600_000);
  });

  it('answers an empty list', async () => {
    mocks.raids.mockResolvedValue([]);
    expect(await (await raids(request('raids'))).json()).toEqual([]);
  });
});

describe('GET /api/helper/raids/[raid]/snapshot', () => {
  it('answers the snapshot builder’s tree, unchanged', async () => {
    const tree = buildSnapshot({
      raid: { id: 'cm9xr2k4a0001', name: 'Molten Core - sample', startsAt: new Date(1792000000 * 1000), durationMin: 240 },
      env: 'production', now: new Date(1791990000 * 1000),
      bosses: [{ id: 'lb_lucifron', name: 'Lucifron', trash: false, items: [16800] }],
      reserves: [{ userId: 'u_bo', characterId: 'c_bo', characterName: 'Bo Marsh', itemId: 16800, kind: 'HR', onTrial: false }],
      winLimits: {}, earlierWins: [], awards: [],
    });
    mocks.raid.mockResolvedValue({ cancelledAt: null });
    mocks.load.mockResolvedValue(tree);
    const res = await getSnapshot('cm9xr2k4a0001');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual(JSON.parse(JSON.stringify(tree)));
    expect(mocks.load).toHaveBeenCalledWith('cm9xr2k4a0001');
  });

  it('answers 404 with an error body for a raid this site doesn’t hold, such as one from the other site', async () => {
    mocks.raid.mockResolvedValue(null);
    const res = await getSnapshot('cmstagingonly1');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'This site has no such raid. It may be from the other site.', code: 'unknown-raid' });
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('answers 404 when the raid is deleted after the check', async () => {
    mocks.raid.mockResolvedValue({ cancelledAt: null });
    mocks.load.mockResolvedValue(null);
    expect((await getSnapshot('r1')).status).toBe(404);
  });

  it('answers 409 for a cancelled raid', async () => {
    mocks.raid.mockResolvedValue({ cancelledAt: new Date() });
    const res = await getSnapshot('r1');
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('raid-cancelled');
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
