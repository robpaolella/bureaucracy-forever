import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Reserves } from '@/components/loot/Reserves';
import { ToastHost } from '@/components/ui/ToastHost';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const props: ComponentProps<typeof Reserves> = {
  raidId: 'r1',
  table: { bosses: [{ id: 'boss', name: 'Onyxia', isTrash: false, itemIds: [100] }], items: { 100: { id: 100, name: 'Deathbringer', quality: 4, icon: '', tooltipHtml: '' } }, blocked: [] },
  reserves: [], lockAt: '2030-01-01T00:00:00Z', locked: false, cancelled: false, officer: false,
  targets: [{ userId: 'u1', name: 'redtape', self: true, characters: [{ id: 'c1', name: 'Redtape', wowClass: 'warrior', isMain: true }], current: { characterId: 'c1', hr: null, sr: null }, blockedHr: { c1: [100] } }],
  reason: null,
};

function render(overrides: Partial<typeof props> = {}) {
  return renderToStaticMarkup(createElement(ToastHost, null, createElement(Reserves, { ...props, ...overrides })));
}

function target(overrides: Partial<(typeof props.targets)[number]>) {
  return [{ ...props.targets[0], ...overrides }];
}

describe('reserve picker', () => {
  it.each([false, true])('keeps a previously-won item readable, but refuses choosing (officer: %s)', (officer) => {
    const html = render({ officer, locked: officer, targets: target({ self: !officer }) });
    expect(html.match(/role="option"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Deathbringer — Epic — Onyxia — HR 0, SR 0 — Previously won"');
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Choose as hard reserve<\/button>/);
    expect(html).toContain('This item is ineligible to be reserved for this raid.');
    expect(html).toContain('Previously won');
    expect(html).toContain('HR</span> · Hard reserve');
    expect(html).toContain('SR</span> · Soft reserve');
  });

  it('does not offer the other slot’s item, or a Clear/None control', () => {
    const html = render({ targets: target({ blockedHr: {}, current: { characterId: 'c1', hr: null, sr: 100 } }) });
    expect(html).toContain('Picked as SR — Your soft reserve');
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Choose as hard reserve<\/button>/);
    expect(html).not.toMatch(/>Clear<|>None</);
  });

  it('allows removing a saved pick even if it became ineligible', () => {
    const html = render({ targets: target({ self: false, current: { characterId: 'c1', hr: 100, sr: null } }) });
    expect(html).toContain('Picked as redtape&#x27;s hard reserve');
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    expect(html).not.toContain('>Choose as hard reserve<');
  });

  it('shows an officer-blocked item with a neutral reason, readable but not choosable', () => {
    const html = render({ table: { ...props.table, blocked: [100] }, targets: target({ blockedHr: {} }) });
    expect(html.match(/role="option"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Deathbringer — Epic — Onyxia — HR 0, SR 0 — Not open to reserves"');
    expect(html).toMatch(/<button[^>]*aria-disabled="true"[^>]*>Choose as hard reserve<\/button>/);
    expect(html).toContain('This item is ineligible to be reserved for this raid. Not open to reserves.');
    expect(html).toMatch(/<p id="[^"]*" class="text-sm text-fg-2"><span class="sr-only">This item is ineligible to be reserved for this raid. <\/span>Not open to reserves<\/p>/);
    expect(html).toContain('<span class="text-fg-2">Not open to reserves</span>');
    expect(html).not.toContain('text-stop');
  });

  it('gives an item both won and blocked only the previously-won reason', () => {
    const html = render({ table: { ...props.table, blocked: [100] } });
    expect(html).toContain('aria-label="Deathbringer — Epic — Onyxia — HR 0, SR 0 — Previously won"');
    expect(html).not.toContain('Not open to reserves');
  });

  it('keeps a saved pick on an item blocked afterwards, with Remove', () => {
    const html = render({ table: { ...props.table, blocked: [100] }, targets: target({ blockedHr: {}, current: { characterId: 'c1', hr: 100, sr: null } }) });
    expect(html).toContain('Picked as your hard reserve');
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    expect(html).not.toContain('>Choose as hard reserve<');
    expect(html).toContain('Picked as HR — Not open to reserves');
    expect(html).toContain('<p class="basis-full text-sm text-fg-2">Not open to reserves. You can keep it or remove it.</p>');
  });

  it('adds no note under a saved pick on an open item', () => {
    const html = render({ targets: target({ blockedHr: {}, current: { characterId: 'c1', hr: 100, sr: null } }) });
    expect(html).toMatch(/<button[^>]*>Remove<\/button>/);
    expect(html).not.toContain('You can keep it or remove it.');
  });

  it.each([{ locked: true }, { cancelled: true }, { targets: [], reason: 'Sign up as Accept or Tentative to reserve.' }])('keeps the picker out of read-only states: %j', (state) => {
    const html = render(state);
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('>Save reserves<');
  });

  it('describes all shared sources and saved counts without changing the item name', () => {
    const html = render({
      table: { ...props.table, bosses: [...props.table.bosses, { id: 'nef', name: 'Nefarian', isTrash: false, itemIds: [100] }] },
      targets: target({ blockedHr: {} }),
      reserves: [{ userId: 'u2', name: 'ledgerline', characterId: 'c2', characterName: 'Ledgerline', wowClass: 'warrior', itemId: 100, kind: 'SR' }],
    });
    expect(html).toContain('aria-label="Deathbringer — Epic — Onyxia, Nefarian — HR 0, SR 1"');
    expect(html).toContain('>Shared<');
    expect(html).toContain('Drops from Onyxia and Nefarian');
    expect(html).toContain('Deathbringer<span class="sr-only">');
  });
});
