import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RESERVES } from '@/content/reserves';
import type { LootTableView, ReserveView } from '@/lib/loot-data';
import { reserveHolders } from '@/lib/loot-rules';
import { ReserveList } from './Reserves';

const item = (id: number, name: string) => ({ id, name, quality: 4, icon: 'inv_misc_questionmark', tooltipHtml: '' });
const table = { bosses: [], blocked: [], items: { 1: item(1, 'Alpha Blade'), 2: item(2, 'Beta Ring') } } as LootTableView;
const reserve = (itemId: number, kind: 'HR' | 'SR', userId: string) => ({ itemId, kind, userId, name: userId, wowClass: 'warrior' }) as unknown as ReserveView;
const render = (reserves: ReserveView[]) => renderToStaticMarkup(<ReserveList table={table} holders={reserveHolders(reserves)} />);

describe('ReserveList', () => {
  it('is collapsed by default, counting distinct items', () => {
    const html = render([reserve(1, 'HR', 'a'), reserve(1, 'SR', 'b'), reserve(2, 'SR', 'c')]);
    expect(html).toContain(RESERVES.showList(2));
    expect(RESERVES.showList(2)).toBe('Show who reserved what · 2 items');
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(html).toMatch(/<ul[^>]*hidden=""/);
    expect(html).not.toContain(RESERVES.hideList);
  });

  it('says "1 item" for a single item', () => {
    expect(RESERVES.showList(1)).toBe('Show who reserved what · 1 item');
  });

  it('with nothing reserved, shows the empty line and no button', () => {
    const html = render([]);
    expect(html).toContain(RESERVES.listEmpty);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<ul');
  });

  it('has a label for the open state', () => {
    expect(RESERVES.hideList).toBe('Hide who reserved what');
  });
});
