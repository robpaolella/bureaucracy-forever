import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOREVERCHANGES_MAX_BYTES } from '@/lib/foreverchanges';

const session = vi.hoisted(() => ({ role: 'officer' as string | null }));
vi.mock('@/lib/session', () => ({ getSession: async () => (session.role ? { role: session.role } : null) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/db', () => ({ db: new Proxy({}, { get: () => { throw new Error('the route must not touch the database'); } }) }));

import { GET, POST } from './route';

const fixture = (name: string) => readFileSync(join(process.cwd(), 'lib/__fixtures__/foreverchanges', `${name}.html`), 'utf8');
const INDEX = fixture('dungeons-index');
const post = (body: unknown) => POST(new Request('https://example.test/api/loot/foreverchanges', { method: 'POST', body: JSON.stringify(body) }));
const fetcher = vi.fn();
const pages: Record<string, string> = {};

beforeEach(() => {
  session.role = 'officer';
  Object.assign(pages, { '/dungeons': INDEX, '/dungeons/the-deadmines': fixture('the-deadmines') });
  fetcher.mockReset().mockImplementation(async (url: URL) => (pages[url.pathname] === undefined ? new Response('', { status: 404 }) : new Response(pages[url.pathname])));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); for (const k of Object.keys(pages)) delete pages[k]; });

const SENTENCE = /Try again later, or load a file manually\.$/;

describe('foreverchanges route', () => {
  it('lists the dungeons on the index, each once', async () => {
    const res = await GET();
    const { dungeons } = await res.json();
    expect(dungeons.map((d: { slug: string }) => d.slug)).toEqual(['hall-of-thanes', 'the-deadmines', 'shadowfang-keep', 'kroldok-stronghold', 'zulfarrak', 'ragefire-chasm', 'ruins-of-lordaeron', 'wailing-caverns']);
    expect(dungeons[3]).toEqual({ slug: 'kroldok-stronghold', name: 'Krol\'dok Stronghold' });
  });

  it('returns a dungeon in the file format, to preview as WoW Forever', async () => {
    const body = await (await post({ slug: 'the-deadmines' })).json();
    expect(body.source).toBe('FOREVER');
    expect(body.name).toBe('WoW Forever: The Deadmines');
    expect(body.file.bosses.map((b: { name: string }) => b.name)).toContain('Trash');
    expect(body.file.bosses[0]).toMatchObject({ name: 'Rhahk\'Zor', trash: false });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(['https://foreverchanges.pro/dungeons', 'https://foreverchanges.pro/dungeons/the-deadmines']);
  });

  it('only fetches dungeons that are on the index', async () => {
    pages['/dungeons/not-listed'] = fixture('the-deadmines');
    for (const slug of ['not-listed', '../admin', 'a/b', 'a#quests', '', 5, undefined]) {
      const res = await post({ slug });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(typeof (await res.json()).error).toBe('string');
    }
    expect(fetcher.mock.calls.every(([url]) => String(url) === 'https://foreverchanges.pro/dungeons')).toBe(true);
    expect((await post({ slug: 'not-listed' })).status).toBe(404);
  });

  it('ignores a URL in the form', async () => {
    await post({ slug: 'the-deadmines', url: 'https://evil.test/' });
    expect(fetcher.mock.calls.every(([url]) => new URL(String(url)).host === 'foreverchanges.pro')).toBe(true);
  });

  it('is for officers only, and fetches nothing otherwise', async () => {
    session.role = 'member';
    expect((await GET()).status).toBe(403);
    expect((await post({ slug: 'the-deadmines' })).status).toBe(403);
    session.role = null;
    expect((await GET()).status).toBe(401);
    expect((await post({ slug: 'the-deadmines' })).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  describe('plain errors', () => {
    const expectPlain = async (res: Response, status: number, pattern: RegExp) => {
      expect(res.status).toBe(status);
      const { error } = await res.json();
      expect(error).toMatch(pattern);
      expect(error).toMatch(SENTENCE);
    };

    it('an unreachable host', async () => {
      fetcher.mockRejectedValue(new Error('ENOTFOUND'));
      await expectPlain(await GET(), 502, /Couldn’t reach foreverchanges\.pro/);
      await expectPlain(await post({ slug: 'the-deadmines' }), 502, /Couldn’t reach foreverchanges\.pro/);
    });

    it('a timeout', async () => {
      fetcher.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
      await expectPlain(await GET(), 502, /too slow/);
    });

    it('an oversized response', async () => {
      fetcher.mockImplementation(async () => new Response('x'.repeat(FOREVERCHANGES_MAX_BYTES + 1)));
      await expectPlain(await GET(), 502, /more than this site will read/);
      await expectPlain(await post({ slug: 'the-deadmines' }), 502, /more than this site will read/);
    });

    it('an off-host redirect', async () => {
      fetcher.mockImplementation(async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/dungeons' } }));
      await expectPlain(await GET(), 502, /Couldn’t reach foreverchanges\.pro/);
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('an index with no dungeons', async () => {
      pages['/dungeons'] = '<html></html>';
      await expectPlain(await GET(), 502, /isn’t in a shape this site knows/);
    });

    it.each(['malformed', 'no-data', 'partial', 'missing-quality', 'no-items'])('a page it can’t convert (%s)', async (name) => {
      pages['/dungeons/the-deadmines'] = fixture(name);
      const res = await post({ slug: 'the-deadmines' });
      await expectPlain(res, 422, /The Deadmines on foreverchanges\.pro couldn’t be read/);
    });
  });
});
