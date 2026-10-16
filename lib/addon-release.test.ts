import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addonForSnapshot, getAddonRelease, getHelperRelease, parseHelperRelease, parseRelease, resetAddonReleaseForTests } from '@/lib/addon-release';

const PAGE = 'https://github.com/robpaolella/bureaucracy-forever-addon/releases/tag/v1.2.0';
const ZIP = 'https://github.com/robpaolella/bureaucracy-forever-addon/releases/download/v1.2.0/BureaucracyLoot-1.2.0.zip';
const github = (over: object = {}) => ({
  tag_name: 'v1.2.0',
  html_url: PAGE,
  published_at: '2026-11-03T18:00:00Z',
  assets: [{ name: 'notes.txt', browser_download_url: 'https://x/notes.txt' }, { name: 'BureaucracyLoot-1.2.0.zip', browser_download_url: ZIP }],
  ...over,
});
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const fetchMock = vi.fn();
beforeEach(() => {
  resetAddonReleaseForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('parseRelease', () => {
  it('takes the version from the tag, the published time, and the zip asset', () => {
    expect(parseRelease(github())).toEqual({ version: '1.2.0', publishedAt: '2026-11-03T18:00:00.000Z', downloadUrl: ZIP });
  });

  it('falls back to the release page when there is no zip asset', () => {
    expect(parseRelease(github({ assets: [] }))?.downloadUrl).toBe(PAGE);
    expect(parseRelease(github({ assets: undefined }))?.downloadUrl).toBe(PAGE);
  });

  it('refuses something that is not a release', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease(github({ tag_name: undefined }))).toBeNull();
    expect(parseRelease(github({ published_at: 'soon' }))).toBeNull();
  });
});

describe('getAddonRelease', () => {
  it('reports a release', async () => {
    fetchMock.mockResolvedValue(ok(github()));
    expect(await getAddonRelease(0)).toEqual({ status: 'release', stale: false, release: expect.objectContaining({ version: '1.2.0', downloadUrl: ZIP }) });
  });

  it('reports no release when GitHub answers not found', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    expect(await getAddonRelease(0)).toEqual({ status: 'none' });
  });

  it('does not call GitHub again within the cache window, and does after it', async () => {
    fetchMock.mockImplementation(async () => ok(github()));
    await getAddonRelease(0);
    await getAddonRelease(5 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getAddonRelease(11 * 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one request between simultaneous page views', async () => {
    fetchMock.mockImplementation(async () => ok(github()));
    await Promise.all([getAddonRelease(0), getAddonRelease(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the last version seen when a later lookup fails', async () => {
    fetchMock.mockResolvedValueOnce(ok(github()));
    await getAddonRelease(0);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await getAddonRelease(11 * 60_000)).toEqual({ status: 'release', stale: true, release: expect.objectContaining({ version: '1.2.0' }) });
  });

  it.each([
    ['a network error', () => Promise.reject(new Error('offline'))],
    ['a rate limit', () => Promise.resolve(new Response('{}', { status: 403 }))],
    ['a server error', () => Promise.resolve(new Response('{}', { status: 502 }))],
    ['an unreadable answer', () => Promise.resolve(new Response('<html>', { status: 200 }))],
  ])('reports none-seen when the first lookup fails with %s', async (_name, answer) => {
    fetchMock.mockImplementation(answer);
    expect(await getAddonRelease(0)).toEqual({ status: 'unreachable' });
  });

  it('retries a failure after a minute, not on every view', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
    await getAddonRelease(0);
    await Promise.resolve();
    await getAddonRelease(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await getAddonRelease(61_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('forgets the last version once GitHub says there is none', async () => {
    fetchMock.mockResolvedValueOnce(ok(github()));
    await getAddonRelease(0);
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await getAddonRelease(11 * 60_000)).toEqual({ status: 'none' });
  });
});

describe('addonForSnapshot', () => {
  it('gives the version and download url, or the placeholder', () => {
    expect(addonForSnapshot({ status: 'release', stale: false, release: { version: '1.2.0', publishedAt: '', downloadUrl: ZIP } })).toEqual({ version: '1.2.0', url: ZIP });
    for (const found of [{ status: 'none' }, { status: 'unreachable' }] as const) {
      expect(addonForSnapshot(found)).toEqual({ version: '', url: 'https://github.com/robpaolella/bureaucracy-forever-addon/releases/latest' });
    }
  });
});

describe('the helper release', () => {
  const HELPER_PAGE = 'https://github.com/robpaolella/bureaucracy-forever-helper/releases/tag/v0.3.0';
  const dl = (n: string) => `https://github.com/robpaolella/bureaucracy-forever-helper/releases/download/v0.3.0/${n}`;
  const NAMES = [
    'bureaucracy-forever-helper_0.3.0_macos-apple-silicon.app.tar.gz',
    'bureaucracy-forever-helper_0.3.0_macos-apple-silicon.app.tar.gz.sig',
    'bureaucracy-forever-helper_0.3.0_macos-intel.dmg',
    'bureaucracy-forever-helper_0.3.0_macos-apple-silicon.dmg',
    'bureaucracy-forever-helper_0.3.0_windows-x64.msi',
    'bureaucracy-forever-helper_0.3.0_windows-x64-setup.exe',
    'bureaucracy-forever-helper_0.3.0_windows-x64-setup.exe.sig',
    'latest.json',
  ];
  const helper = (over: object = {}) => ({
    tag_name: 'v0.3.0',
    html_url: HELPER_PAGE,
    published_at: '2026-11-08T12:00:00Z',
    assets: NAMES.map((name) => ({ name, browser_download_url: dl(name) })),
    ...over,
  });
  const route = (addon: () => Response, helperRes: () => Response) =>
    fetchMock.mockImplementation(async (url: string) => (url.includes('-helper/') ? helperRes() : addon()));

  it('picks the Apple silicon dmg and the Windows setup exe by file name', () => {
    expect(parseHelperRelease(helper())).toEqual({
      version: '0.3.0',
      publishedAt: '2026-11-08T12:00:00.000Z',
      macUrl: dl('bureaucracy-forever-helper_0.3.0_macos-apple-silicon.dmg'),
      windowsUrl: dl('bureaucracy-forever-helper_0.3.0_windows-x64-setup.exe'),
    });
  });

  it('links the release page for a button with no matching file', () => {
    const only = NAMES.filter((n) => n.endsWith('.msi') || n.endsWith('.sig') || n.endsWith('intel.dmg'));
    const r = parseHelperRelease(helper({ assets: only.map((name) => ({ name, browser_download_url: dl(name) })) }));
    expect(r?.macUrl).toBe(HELPER_PAGE);
    expect(r?.windowsUrl).toBe(HELPER_PAGE);
    expect(parseHelperRelease(helper({ assets: undefined }))?.macUrl).toBe(HELPER_PAGE);
  });

  it('refuses something that is not a release', () => {
    expect(parseHelperRelease({})).toBeNull();
  });

  it('reports a release, none, and unreachable from the helper repo', async () => {
    fetchMock.mockResolvedValueOnce(ok(helper()));
    expect(await getHelperRelease(0)).toEqual({ status: 'release', stale: false, release: expect.objectContaining({ version: '0.3.0' }) });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.github.com/repos/robpaolella/bureaucracy-forever-helper/releases/latest');
    resetAddonReleaseForTests();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await getHelperRelease(0)).toEqual({ status: 'none' });
    resetAddonReleaseForTests();
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await getHelperRelease(0)).toEqual({ status: 'unreachable' });
  });

  it('keeps the last version seen when GitHub goes down, and retries after a minute', async () => {
    fetchMock.mockResolvedValueOnce(ok(helper()));
    await getHelperRelease(0);
    fetchMock.mockRejectedValueOnce(new Error('down'));
    expect(await getHelperRelease(11 * 60_000)).toEqual({ status: 'release', stale: true, release: expect.objectContaining({ version: '0.3.0' }) });
    await Promise.resolve();
    fetchMock.mockResolvedValueOnce(ok(helper({ tag_name: 'v0.4.0' })));
    const next = await getHelperRelease(11 * 60_000 + 61_000);
    expect(next).toMatchObject({ status: 'release', stale: false, release: { version: '0.4.0' } });
  });

  it('keeps the add-on and helper caches and last-seen versions apart', async () => {
    route(() => ok(github()), () => ok(helper()));
    const [a, h] = await Promise.all([getAddonRelease(0), getHelperRelease(0)]);
    expect(a).toMatchObject({ release: { version: '1.2.0' } });
    expect(h).toMatchObject({ release: { version: '0.3.0' } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The helper going down must not show the add-on's version, nor disturb the add-on's cache.
    route(() => ok(github()), () => new Response('x', { status: 500 }));
    expect(await getAddonRelease(5 * 60_000)).toBe(a);
    expect(await getHelperRelease(11 * 60_000)).toMatchObject({ stale: true, release: { version: '0.3.0' } });
    // A helper with no release does not clear the add-on's last seen version.
    route(() => new Response('x', { status: 500 }), () => new Response('{}', { status: 404 }));
    expect(await getHelperRelease(23 * 60_000)).toEqual({ status: 'none' });
    expect(await getAddonRelease(23 * 60_000)).toMatchObject({ stale: true, release: { version: '1.2.0' } });
  });
});
