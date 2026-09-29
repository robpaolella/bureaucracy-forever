import { describe, expect, it, vi } from 'vitest';
import { fetchItem, iconUrl, parseTooltipJson, throttled, tooltipUrl } from './wowhead';

const BODY = { name: "Bonereaver's Edge", quality: 4, icon: 'INV_Sword_12', tooltip: '<table></table>' };
const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('wowhead', () => {
  it('builds tooltip and icon URLs per database', () => {
    expect(tooltipUrl(17076, 'CLASSIC')).toBe('https://nether.wowhead.com/classic/tooltip/item/17076');
    expect(tooltipUrl(17076, 'FOREVER')).toBe('https://nether.wowhead.com/forever/tooltip/item/17076');
    expect(iconUrl('inv_sword_12', 'small')).toBe('https://wow.zamimg.com/images/wow/icons/small/inv_sword_12.jpg');
  });

  it('reads an item and lowercases the icon', () => {
    expect(parseTooltipJson(17076, BODY)).toEqual({ ok: true, item: { id: 17076, name: "Bonereaver's Edge", quality: 4, icon: 'inv_sword_12', tooltip: '<table></table>' } });
  });

  it.each([
    [{ error: 'Entity not found' }, 'Entity not found'],
    [{ ...BODY, name: '' }, 'Unexpected response from Wowhead.'],
    [null, 'Unexpected response from Wowhead.'],
    [{ ...BODY, icon: '../../evil' }, 'Unexpected icon name from Wowhead.'],
  ])('refuses %j', (body, error) => {
    expect(parseTooltipJson(1, body)).toEqual({ ok: false, id: 1, error });
  });

  it('fetches, and reports 404 bodies and server errors', async () => {
    expect(await fetchItem(17076, 'CLASSIC', respond(200, BODY))).toMatchObject({ ok: true });
    expect(await fetchItem(1, 'FOREVER', respond(404, { error: 'Entity not found' }))).toEqual({ ok: false, id: 1, error: 'Entity not found' });
    expect(await fetchItem(1, 'CLASSIC', respond(503, {}))).toEqual({ ok: false, id: 1, error: 'Wowhead answered 503.' });
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await fetchItem(1, 'CLASSIC', down)).toEqual({ ok: false, id: 1, error: 'Could not reach Wowhead.' });
  });

  it('runs one request at a time with a gap between them', async () => {
    vi.useFakeTimers();
    const seen: number[] = [];
    const run = throttled([1, 2, 3], async (id) => {
      seen.push(id);
      return id * 10;
    }, 1000);
    await vi.advanceTimersByTimeAsync(0);
    expect(seen).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await run).toEqual([10, 20, 30]);
    vi.useRealTimers();
  });
});
