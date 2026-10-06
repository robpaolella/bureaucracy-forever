import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Reserves } from '@/components/loot/Reserves';
import { ReserveWindow } from '@/components/loot/ReserveWindow';
import { ToastHost } from '@/components/ui/ToastHost';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const props: ComponentProps<typeof Reserves> = {
  raid: { id: 'r1', name: "Onyxia's Lair", startsAt: '2030-01-01T02:00:00Z' },
  table: { bosses: [{ id: 'boss', name: 'Onyxia', isTrash: false, itemIds: [100] }], items: { 100: { id: 100, name: 'Deathbringer', quality: 4, icon: '', tooltipHtml: '' } }, blocked: [] },
  reserves: [], lockAt: '2030-01-01T00:00:00Z', locked: false, cancelled: false, officer: false,
  targets: [{ userId: 'u1', name: 'redtape', self: true, characters: [{ id: 'c1', name: 'Redtape', wowClass: 'warrior', isMain: true }], current: { characterId: 'c1', hr: null, sr: null }, blockedHr: { c1: [100] } }],
  reason: null,
};

/** The section, read-only parts and buttons; the picker itself is in the window. */
function section(overrides: Partial<typeof props> = {}) {
  return renderToStaticMarkup(createElement(ToastHost, null, createElement(Reserves, { ...props, ...overrides })));
}

/** The open reserves window over the same data. */
function render(overrides: Partial<typeof props> = {}) {
  const p = { ...props, ...overrides };
  return renderToStaticMarkup(createElement(ReserveWindow, { open: true, onClose: () => {}, raid: p.raid, data: p, notify: () => {} }));
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

  it('names the member an officer picks for in the other slot’s reason', () => {
    const html = render({ officer: true, targets: target({ self: false, blockedHr: {}, current: { characterId: 'c1', hr: null, sr: 100 } }) });
    expect(html).toContain('Picked as SR — redtape&#x27;s soft reserve');
    expect(html).not.toContain('Your soft reserve');
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

  it.each([{ locked: true }, { cancelled: true }, { targets: [], reason: 'You must be signed up for this raid to reserve items.' }])('keeps the window out of read-only states: %j', (state) => {
    const html = section(state);
    expect(html).not.toContain('role="listbox"');
    expect(html).not.toContain('>Save reserves<');
    expect(html).not.toMatch(/>(Pick|Change) reserves</);
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

describe('reserves section', () => {
  const saved = target({ current: { characterId: 'c1', hr: 100, sr: null } });

  it('shows the lock time once, in the lede', () => {
    const html = section();
    expect(html).toContain('Reserves for this raid will lock at <');
    expect(html).not.toContain('Reserves lock<');
  });

  it('offers "Pick reserves" with no picks, and "Change reserves" with saved ones', () => {
    expect(section()).toContain('You haven&#x27;t picked reserves for this raid.');
    expect(section()).toMatch(/>Pick reserves<\/button>/);
    const html = section({ targets: saved });
    expect(html).toContain('Your reserves · Redtape · Warrior');
    expect(html).toMatch(/>Change reserves<\/button>/);
    expect(html).toContain('HR<span class="sr-only"> (Hard reserve)</span>');
    expect(html).toContain('>Onyxia<');
    expect(html).toContain('SR<span class="sr-only"> (Soft reserve)</span></span><span class="text-fg-3">None</span>');
  });

  it('shows a member their picks read-only after the lock', () => {
    const html = section({ locked: true, targets: saved });
    expect(html).toContain('Reserves are locked. Please contact an officer to request a change.');
    expect(html).toContain('Your reserves · Redtape · Warrior');
    expect(html).not.toMatch(/>(Pick|Change) reserves</);
  });

  it('lets an officer choose a member and still change reserves after the lock', () => {
    const other = { ...props.targets[0], userId: 'u2', name: 'codicil', self: false };
    const html = section({ officer: true, locked: true, targets: [...props.targets, other] });
    expect(html).toContain('Reserves are locked. As an officer, you can still change them.');
    expect(html).toContain('Reserves for');
    expect(html).toContain('>redtape (you)</option>');
    expect(html).toContain('>codicil</option>');
    expect(html).toMatch(/>Change reserves<\/button>/);
  });

  it('explains why a member who is not signed up cannot reserve', () => {
    const html = section({ targets: [], reason: 'You must be signed up for this raid to reserve items.' });
    expect(html).toContain('You must be signed up for this raid to reserve items.');
    expect(html).not.toContain('<button');
  });

  it('shows only the cancelled message on a cancelled raid', () => {
    const html = section({ cancelled: true, targets: saved });
    expect(html).toContain('This raid was cancelled.');
    expect(html).not.toContain('Your reserves');
  });
});

describe('reserves window', () => {
  const open = (extra: Partial<ComponentProps<typeof ReserveWindow>> = {}) =>
    renderToStaticMarkup(createElement(ReserveWindow, { open: true, onClose: () => {}, raid: props.raid, data: props, notify: () => {}, ...extra }));

  it('follows a sign-up with its line and Undo, the raid, the lock and "Not now"', () => {
    const html = open({ confirm: { text: "You're in for Wednesday — Onyxia's Lair", onUndo: () => {} } });
    expect(html).toContain('>Pick your reserves<');
    expect(html).toContain('You&#x27;re in for Wednesday — Onyxia&#x27;s Lair');
    expect(html).toMatch(/>Undo<\/button>/);
    expect(html).toContain('Onyxia&#x27;s Lair · Monday, Dec 31');
    expect(html).toContain('You can change your selection until <');
    expect(html).toMatch(/>Not now<\/button>/);
    expect(html).toMatch(/type="submit"[^>]*>Save reserves<\/button>/);
  });

  it('opens from the section with "Cancel", and names the member an officer picks for', () => {
    const other = { ...props.targets[0], userId: 'u2', name: 'codicil', self: false };
    const html = open({ data: { ...props, targets: [...props.targets, other] }, targetId: 'u2' });
    expect(html).toContain('>Pick reserves for codicil<');
    expect(html).toContain('Reserves for');
    expect(html).toMatch(/>Cancel<\/button>/);
    expect(html).not.toContain('Undo');
  });
});
