// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RosterTable } from './RosterTable';
import type { RosterRow } from '@/lib/roster';
import { CLASS_COLORS } from '@/lib/design/class-colors';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const main: RosterRow = { id: 'member', name: 'Ledgerline', character: 'Ledgerline', wowClass: 'warrior', spec: 'Protection', role: 'tank', rank: 'officer', attendance: 0.9, joinedAt: '2026-01-01T00:00:00Z', alts: [] };
const alts: RosterRow['alts'] = [
  { id: 'a', name: 'Inkwell', wowClass: 'mage', spec: 'Frost', role: 'ranged' },
  { id: 'b', name: 'Sealwax', wowClass: 'priest', spec: 'Holy', role: 'healer' },
];
let host: HTMLDivElement;
let root: Root;

async function render(rows: RosterRow[]) {
  await act(async () => root.render(<RosterTable rows={rows} />));
}

async function search(value: string) {
  const input = host.querySelector('input[type="search"]') as HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('roster alt disclosure', () => {
  it('keeps one member row, starts collapsed, and synchronises the desktop and phone disclosures', async () => {
    await render([{ ...main, alts }, { ...main, id: 'other', name: 'Subclause' }]);

    expect(host.querySelectorAll('tbody > tr')).toHaveLength(2);
    expect(host.querySelectorAll('button[aria-label="Alts (2)"]')).toHaveLength(0);
    const buttons = [...host.querySelectorAll('button')].filter((button) => button.textContent === 'Alts (2)');
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(host.querySelectorAll('[aria-label="Alts for Ledgerline"]')).toHaveLength(0);
    expect(host.textContent).toContain('2 of 2 shown');

    await act(async () => buttons[0].click());
    expect(host.querySelectorAll('[aria-label="Alts for Ledgerline"]')).toHaveLength(2);
    expect(host.querySelectorAll('tbody > tr')).toHaveLength(3);
    expect([...host.querySelectorAll('button')].filter((button) => button.textContent === 'Alts (2)').every((button) => button.getAttribute('aria-expanded') === 'true')).toBe(true);
    expect(host.textContent).toContain('Inkwell · Mage · Frost · Ranged DPS');
    expect(host.textContent).toContain('Sealwax · Priest · Holy · Healer');
    expect(host.innerHTML).toContain(`color: ${CLASS_COLORS.mage.onInk}`);
  });

  it('auto-expands only alt-name search matches, clears derived expansion, and preserves a manual choice', async () => {
    await render([{ ...main, alts }]);
    await search('inkwell');
    expect(host.querySelectorAll('[aria-label="Alts for Ledgerline"]')).toHaveLength(2);

    await search('ledgerline');
    expect(host.querySelectorAll('[aria-label="Alts for Ledgerline"]')).toHaveLength(0);

    const desktopButton = [...host.querySelectorAll('button')].find((button) => button.textContent === 'Alts (2)')!;
    await act(async () => desktopButton.click());
    await search('');
    expect(host.querySelectorAll('[aria-label="Alts for Ledgerline"]')).toHaveLength(2);
  });

  it('omits the disclosure for main-only and no-main members', async () => {
    const bare = { ...main, id: 'bare', character: null, wowClass: null, spec: null, role: null, alts: [] };
    await render([main, bare]);
    expect(host.textContent).not.toContain('Alts for');
    expect([...host.querySelectorAll('button')].some((button) => button.textContent?.startsWith('Alts ('))).toBe(false);
    expect(host.textContent).toContain('No main yet');
  });
});
