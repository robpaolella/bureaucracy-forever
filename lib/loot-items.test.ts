import { describe, expect, it, vi } from 'vitest';
import { refreshItems, toItemView } from './loot-items';

const now = new Date('2026-09-29T18:00:00.000Z');

function fakeFetch(bodies: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const id = url.split('/').pop()!;
    const body = bodies[id] ?? { error: 'Entity not found' };
    return new Response(JSON.stringify(body), { status: 'error' in (body as object) ? 404 : 200 });
  }) as unknown as typeof fetch;
}

describe('loot items', () => {
  it('upserts what Wowhead returns with the tooltip sanitized, and reports the rest', async () => {
    const upsert = vi.fn();
    const fetcher = fakeFetch({ 17076: { name: "Bonereaver's Edge", quality: 4, icon: 'inv_sword_12', tooltip: '<b class="q4">B</b><script>x</script>' } });
    const res = await refreshItems({ lootItem: { upsert } } as never, [{ id: 17076, source: 'CLASSIC' }, { id: 5, source: 'FOREVER' }], { fetcher, gapMs: 0, now: () => now });
    expect(res).toEqual({ saved: [17076], failed: [{ id: 5, error: 'Entity not found' }] });
    const data = { name: "Bonereaver's Edge", quality: 4, icon: 'inv_sword_12', tooltipHtml: '<b class="q4">B</b>', source: 'CLASSIC', fetchedAt: now };
    expect(upsert).toHaveBeenCalledWith({ where: { id: 17076 }, create: { id: 17076, ...data }, update: data });
    expect(vi.mocked(fetcher).mock.calls.map((c) => c[0])).toEqual(['https://nether.wowhead.com/classic/tooltip/item/17076', 'https://nether.wowhead.com/forever/tooltip/item/5']);
  });

  it('sanitizes stored tooltips again on the way to a page', () => {
    expect(toItemView({ id: 1, name: 'X', quality: 3, icon: 'i', tooltipHtml: '<span onclick="x" class="q3">X</span>' }).tooltipHtml).toBe('<span class="q3">X</span>');
  });
});
