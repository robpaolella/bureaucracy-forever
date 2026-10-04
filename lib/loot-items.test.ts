import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshItems, toItemView } from './loot-items';
import { FOREVER_ONLY, SOURCE_CONFLICT } from './item-sources';

const now = new Date('2026-09-29T18:00:00.000Z');
const findUnique = vi.fn();
const upsert = vi.fn();
const client = { lootItem: { findUnique, upsert } } as never;

function fakeFetch(bodies: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const id = url.split('/').pop()!;
    const body = bodies[id] ?? { error: 'Entity not found' };
    return new Response(JSON.stringify(body), { status: 'error' in (body as object) ? 404 : 200 });
  }) as unknown as typeof fetch;
}
const item = { name: 'A', quality: 2, icon: 'a', tooltip: '' };

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'development');
  findUnique.mockReset().mockResolvedValue(null);
  upsert.mockReset().mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

describe('loot items', () => {
  it('upserts what Wowhead returns with the tooltip sanitized, and reports the rest', async () => {
    const fetcher = fakeFetch({ 17076: { name: "Bonereaver's Edge", quality: 4, icon: 'inv_sword_12', tooltip: '<b class="q4">B</b><script>x</script>' } });
    const res = await refreshItems(client, [{ id: 17076, source: 'CLASSIC' }, { id: 5, source: 'FOREVER' }], { fetcher, gapMs: 0, now: () => now });
    expect(res).toEqual({ saved: [17076], failed: [{ id: 5, error: 'Entity not found' }], notReached: [] });
    const data = { name: "Bonereaver's Edge", quality: 4, icon: 'inv_sword_12', tooltipHtml: '<b class="q4">B</b>', fetchedAt: now };
    expect(upsert).toHaveBeenCalledWith({ where: { id: 17076, source: 'CLASSIC' }, create: { id: 17076, source: 'CLASSIC', ...data }, update: data });
    expect(vi.mocked(fetcher).mock.calls.map((c) => c[0])).toEqual(['https://nether.wowhead.com/classic/tooltip/item/17076', 'https://nether.wowhead.com/forever/tooltip/item/5']);
  });

  it('keeps going when a save fails, and fetches a repeated id once', async () => {
    upsert.mockRejectedValueOnce(new Error('db down'));
    const fetcher = fakeFetch({ 1: item, 2: item });
    const res = await refreshItems(client, [{ id: 1, source: 'CLASSIC' }, { id: 2, source: 'CLASSIC' }, { id: 2, source: 'CLASSIC' }], { fetcher, gapMs: 0 });
    expect(res).toEqual({ saved: [2], failed: [{ id: 1, error: 'Could not save it.' }], notReached: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refuses Classic before fetching or writing in production, but saves Forever', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const fetcher = fakeFetch({ 1: item, 2: item });
    const res = await refreshItems(client, [{ id: 1, source: 'CLASSIC' }, { id: 2, source: 'FOREVER' }], { fetcher, gapMs: 0 });
    expect(res).toEqual({ saved: [2], failed: [{ id: 1, error: FOREVER_ONLY }], notReached: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://nether.wowhead.com/forever/tooltip/item/2', expect.anything());
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it.each(['CLASSIC', 'FOREVER'] as const)('refuses an existing %s item from the other game without fetching or writing', async (source) => {
    findUnique.mockResolvedValue({ source: source === 'CLASSIC' ? 'FOREVER' : 'CLASSIC' });
    const fetcher = fakeFetch({ 1: item });
    expect(await refreshItems(client, [{ id: 1, source }], { fetcher, gapMs: 0 })).toEqual({ saved: [], failed: [{ id: 1, error: SOURCE_CONFLICT }], notReached: [] });
    expect(fetcher).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each(['CLASSIC', 'FOREVER'] as const)('refreshes an existing %s item without updating its source', async (source) => {
    findUnique.mockResolvedValue({ source });
    expect((await refreshItems(client, [{ id: 1, source }], { fetcher: fakeFetch({ 1: item }), gapMs: 0 })).saved).toEqual([1]);
    expect(upsert.mock.calls[0][0].where).toEqual({ id: 1, source });
    expect(upsert.mock.calls[0][0].update).not.toHaveProperty('source');
  });

  it('refuses mixed-source duplicates rather than letting the last target win', async () => {
    const fetcher = fakeFetch({ 1: item });
    const res = await refreshItems(client, [{ id: 1, source: 'CLASSIC' }, { id: 1, source: 'FOREVER' }], { fetcher, gapMs: 0 });
    expect(res.failed).toEqual([{ id: 1, error: SOURCE_CONFLICT }]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each(['conditional upsert', 'unique violation'])('reports a source collision from a concurrent insert (%s), with no successful save', async (mode) => {
    if (mode === 'conditional upsert') upsert.mockResolvedValue(null);
    else upsert.mockRejectedValue({ code: 'P2002' });
    const res = await refreshItems(client, [{ id: 1, source: 'FOREVER' }], { fetcher: fakeFetch({ 1: item }), gapMs: 0 });
    expect(res).toEqual({ saved: [], failed: [{ id: 1, error: SOURCE_CONFLICT }], notReached: [] });
    expect(upsert.mock.calls[0][0].where).toEqual({ id: 1, source: 'FOREVER' });
  });

  it('keeps going after a cache lookup fails', async () => {
    findUnique.mockRejectedValueOnce(new Error('db down'));
    const res = await refreshItems(client, [{ id: 1, source: 'FOREVER' }, { id: 2, source: 'FOREVER' }], { fetcher: fakeFetch({ 2: item }), gapMs: 0 });
    expect(res).toEqual({ saved: [2], failed: [{ id: 1, error: 'Could not save it.' }], notReached: [] });
  });

  it('starts no request after the deadline', async () => {
    const fetcher = fakeFetch({ 1: item });
    const res = await refreshItems(client, [{ id: 1, source: 'CLASSIC' }, { id: 2, source: 'CLASSIC' }], { fetcher, gapMs: 0, deadline: Date.now() - 1 });
    expect(res).toEqual({ saved: [], failed: [], notReached: [1, 2] });
    expect(fetcher).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('sanitizes stored tooltips again on the way to a page', () => {
    expect(toItemView({ id: 1, name: 'X', quality: 3, icon: 'i', tooltipHtml: '<span onclick="x" class="q3">X</span>' }).tooltipHtml).toBe('<span class="q3">X</span>');
  });
});
