import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
import { LootHistory } from './LootHistory';
import type { LootHistoryView } from '@/lib/member-loot';

const award = { id: 'a', item: { id: 1, name: 'Blade', icon: 'inv', quality: 4, tooltipHtml: '' }, characterId: 'c1', characterName: 'Treaty', wowClass: 'priest' as const, method: 'SR' as const, roll: 74, bossName: 'Onyxia' };
const base: LootHistoryView = {
  raids: [{ id: 'r1', name: 'Molten Core', startsAt: '2030-01-01T20:00:00.000Z', awards: [award] }], next: null,
  total: 4, filteredTotal: 1, filters: { characterId: 'c1' },
  options: { characters: [{ id: 'c1', name: 'Treaty' }, { id: 'c2', name: 'No loot' }], formerCharacters: ['Stipulate'], raids: [{ id: 't1', name: 'Molten Core' }] },
};
const render = (history = base) => renderToStaticMarkup(<LootHistory initial={history} />);

describe('LootHistory', () => {
  it('shows selected filters and the approved flat character table without a winner column', () => {
    const html = render();
    for (const text of ['Treaty', 'No loot', 'No longer on the roster', 'Stipulate', '1 of 4 awards', 'Item', 'Raid', 'Method · roll', 'Boss', 'Molten Core']) expect(html).toContain(text);
    expect(html).not.toContain('Winner');
  });
  it('links current character names in Everyone view but not deleted names', () => {
    const html = render({ ...base, filters: {}, filteredTotal: 4 });
    expect(html).toContain('href="/members/loot?characterId=c1"');
  });
  it('uses the dashed no-results state and keeps the full total', () => {
    const html = render({ ...base, raids: [], filteredTotal: 0, filters: { characterName: 'Stipulate', templateId: 't1' } });
    expect(html).toContain('0 of 4 awards'); expect(html).toContain('No loot matches those filters.'); expect(html).toContain('Clear filters'); expect(html).toContain('border-dashed');
  });
  it('does not offer filters when no visible awards exist', () => {
    const html = render({ ...base, raids: [], total: 0, filteredTotal: 0, filters: {} });
    expect(html).toContain('No loot recorded yet'); expect(html).not.toContain('Filters');
  });
});
