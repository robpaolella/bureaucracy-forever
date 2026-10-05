import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Reserves } from '@/components/loot/Reserves';
import { ToastHost } from '@/components/ui/ToastHost';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

describe('reserve form previously-won choices', () => {
  it.each([false, true])('disables and labels both choices (officer: %s)', (officer) => {
    const html = renderToStaticMarkup(createElement(ToastHost, null, createElement(Reserves, {
      raidId: 'r1',
      table: { bosses: [{ id: 'boss', name: 'Onyxia', isTrash: false, itemIds: [100] }], items: { 100: { id: 100, name: 'Deathbringer', quality: 4, icon: '', tooltipHtml: '' } } },
      reserves: [], lockAt: '2030-01-01T00:00:00Z', locked: officer, cancelled: false, officer,
      targets: [{ userId: 'u1', name: 'redtape', self: !officer, characters: [{ id: 'c1', name: 'Redtape', wowClass: 'warrior', isMain: true }], current: { characterId: 'c1', hr: null, sr: null }, blockedHr: { c1: [100] } }],
      reason: null,
    })));
    const wonOptions = html.match(/<option[^>]*value="100"[^>]*>[^<]*<\/option>/g);
    expect(wonOptions).toHaveLength(2);
    for (const option of wonOptions!) {
      expect(option).toContain('disabled=""');
      expect(option).toContain('Deathbringer — Previously won');
    }
  });
});
