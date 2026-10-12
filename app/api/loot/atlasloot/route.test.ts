import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOREVER_ONLY } from '@/lib/item-sources';

const session = vi.hoisted(() => ({ role: 'officer' as string | null }));
vi.mock('@/lib/session', () => ({ getSession: async () => (session.role ? { role: session.role } : null) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));

import { GET, POST } from './route';

const LUA = `
data["MoltenCore"] = { ContentType = RAID40_CONTENT, items = { { name = AL["Lucifron"], [NORMAL_DIFF] = { { 1, 16800 } } } } }
data["Onyxia"] = { ContentType = RAID40_CONTENT, items = { { name = AL["Onyxia"], [NORMAL_DIFF] = { { 1, 18705 } } } } }
data["Zul'Gurub"] = { ContentType = RAID20_CONTENT, items = { { name = AL["Venoxis"], [NORMAL_DIFF] = { { 1, 19900 } } } } }
data["Ragefire"] = { ContentType = DUNGEON_CONTENT, items = {} }
`;
const post = (body: unknown) => POST(new Request('https://example.test/api/loot/atlasloot', { method: 'POST', body: JSON.stringify(body) }));
const fetcher = vi.fn();

beforeEach(() => {
  session.role = 'officer';
  fetcher.mockReset().mockImplementation(async () => new Response(LUA));
  vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('ATLASLOOT_DATA_URL', '');
  vi.stubEnv('ATLASLOOT_ITEM_SOURCE', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('AtlasLoot route', () => {
  it('lists the raids with the configured item database', async () => {
    const res = await GET();
    expect(await res.json()).toEqual({ source: 'CLASSIC', off: false, raids: [{ key: 'MoltenCore', name: 'Molten Core' }, { key: 'Onyxia', name: 'Onyxia’s Lair' }, { key: 'Zul\'Gurub', name: 'Zul\'Gurub' }] });
    expect(fetcher.mock.calls[0][0]).toContain('raw.githubusercontent.com');
  });

  it('reads the data from the configured address', async () => {
    vi.stubEnv('ATLASLOOT_DATA_URL', 'https://example.test/data.lua');
    await GET();
    expect(fetcher.mock.calls[0][0]).toBe('https://example.test/data.lua');
  });

  it('returns a raid key’s table in the file format, with the source to preview it as', async () => {
    const res = await post({ raidKey: 'Onyxia' });
    expect(await res.json()).toEqual({ source: 'CLASSIC', name: 'AtlasLoot: Onyxia’s Lair', file: { bosses: [{ name: 'Onyxia', trash: false, items: [18705] }] } });
  });

  it('loads every raid it offers', async () => {
    const { raids } = await (await GET()).json();
    for (const { key } of raids) expect((await post({ raidKey: key })).status).toBe(200);
  });

  it('says so plainly when the data is not AtlasLoot’s format', async () => {
    fetcher.mockImplementation(async () => new Response('data["Onyxia"] = {'));
    for (const res of [await GET(), await post({ raidKey: 'Onyxia' })]) {
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Couldn’t read AtlasLoot’s data. Try again later, or load a file manually.' });
    }
  });

  it('ignores a URL or version in the form: only the raid key counts', async () => {
    await post({ raidKey: 'Onyxia', url: 'https://evil.test/x.lua', version: 'main' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain('raw.githubusercontent.com');
  });

  it('refuses a raid key that is not in the data, or is not a raid', async () => {
    for (const raidKey of ['Naxxramas', 'Ragefire', 'Onyxia"]', 42, '']) {
      const res = await post({ raidKey });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(await res.json())).toMatch(/raid/i);
    }
  });

  it('names the missing raid with the full sentence', async () => {
    const res = await post({ raidKey: 'Naxxramas' });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file manually.' });
  });

  it('says so plainly when the data can’t be downloaded', async () => {
    fetcher.mockResolvedValue(new Response('nope', { status: 404 }));
    for (const res of [await GET(), await post({ raidKey: 'Onyxia' })]) {
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ error: 'Couldn’t download AtlasLoot’s data. Try again, or load a file manually.' });
    }
    fetcher.mockRejectedValue(new Error('offline'));
    expect((await GET()).status).toBe(502);
  });

  describe('on the live site', () => {
    beforeEach(() => vi.stubEnv('VERCEL_ENV', 'production'));

    it('greys AtlasLoot for a Classic item database and fetches nothing', async () => {
      expect(await (await GET()).json()).toEqual({ source: 'CLASSIC', off: true, raids: [] });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('refuses a Classic load whatever the form says', async () => {
      const res = await post({ raidKey: 'Onyxia', source: 'FOREVER' });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: FOREVER_ONLY });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('offers AtlasLoot once the item database is Forever', async () => {
      vi.stubEnv('ATLASLOOT_ITEM_SOURCE', 'FOREVER');
      expect(await (await GET()).json()).toMatchObject({ source: 'FOREVER', off: false });
      expect(await (await post({ raidKey: 'Onyxia' })).json()).toMatchObject({ source: 'FOREVER' });
    });
  });

  it('is for officers only', async () => {
    session.role = 'member';
    expect((await GET()).status).toBe(403);
    expect((await post({ raidKey: 'Onyxia' })).status).toBe(403);
    session.role = null;
    expect((await GET()).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
