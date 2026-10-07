// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RaidCard } from '@/lib/raids';
import { RaidResponseControl } from './RaidResponse';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => null }));
vi.mock('@/components/loot/ReserveWindow', () => ({
  useReservePrompt: () => ({ afterAnswer: async () => false, window: null }),
}));

const characters = [
  { id: 'main', name: 'Redtape', wowClass: 'warrior' as const, role: 'tank' as const },
  { id: 'alt', name: 'Triplicate', wowClass: 'mage' as const, role: 'ranged' as const },
];
const card = (over: Partial<RaidCard> = {}): RaidCard => ({
  id: 'raid', name: 'Molten Core', startsAt: '2030-01-01T20:00:00Z', durationMin: 180,
  notes: null, cancelled: false, requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 },
  counts: { tank: 1, healer: 8, melee: 9, ranged: 10 }, mine: 'accept', signupRole: 'tank', onRoster: true, ...over,
});
const response = (status = 200, body: unknown = { character: { id: 'alt', name: 'Triplicate', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' }, removed: [] }) => ({ ok: status < 400, status, json: async () => body });
const fetcher = vi.fn();
let root: Root, host: HTMLDivElement;

function render(over: Partial<ComponentProps<typeof RaidResponseControl>> = {}) {
  return act(async () => root.render(
    <RaidResponseControl
      raid={card()}
      viewer={{ role: 'member', raidRole: 'tank' }}
      characters={characters}
      broughtId="main"
      past={false}
      now="2029-01-01T00:00:00Z"
      {...over}
    />,
  ));
}
function select() { return host.querySelector('select')!; }
async function choose(value: string) {
  await act(async () => { select().value = value; select().dispatchEvent(new Event('change', { bubbles: true })); });
}

beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('RaidResponseControl character choice', () => {
  it.each([
    ['a main-only member', { characters: [characters[0]] }],
    ['a social member', { viewer: { role: 'social' as const, raidRole: 'tank' as const } }],
    ['an Absent answer', { raid: card({ mine: 'absent' }) }],
    ['no sign-up', { raid: card({ mine: null }), broughtId: null }],
  ])('does not show Bringing for %s', async (_state, props) => {
    await render(props);
    expect(host.textContent).not.toContain('Bringing');
    expect(host.querySelector('select')).toBeNull();
  });

  it('shows the brought character and switches with that character role', async () => {
    fetcher.mockResolvedValue(response());
    await render({ broughtId: 'alt' });
    expect(host.textContent).toContain('Bringing');
    expect(select().value).toBe('alt');
    expect(select().textContent).toContain('Triplicate · Mage');
    await choose('main');
    expect(fetcher).toHaveBeenCalledWith('/api/raids/raid/signup/character', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ characterId: 'main' }), credentials: 'same-origin',
    }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('re-syncs the selected character after a refreshed server choice', async () => {
    await render();
    expect(select().value).toBe('main');
    await render({ broughtId: 'alt' });
    expect(select().value).toBe('alt');
  });

  it('disables both controls while a switch is pending', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetcher.mockReturnValue(new Promise<ReturnType<typeof response>>((done) => { resolve = done; }));
    await render(); await choose('alt');
    expect(select().disabled).toBe(true);
    expect([...host.querySelectorAll('[role="radio"]')].every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    await act(async () => { resolve(response()); });
  });

  it('announces reserves removed by a successful switch', async () => {
    fetcher.mockResolvedValue(response(200, { character: { id: 'alt', name: 'Triplicate', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' }, removed: [
      { kind: 'HR', itemId: 1, itemName: 'Blade', reason: 'Already won.' },
    ] }));
    await render(); await choose('alt');
    expect(host.textContent).toContain('Character changed');
    expect(host.textContent).toContain('Removed hard reserve on Blade: Already won.');
  });

  it('reverts and becomes read-only after a lock refusal', async () => {
    fetcher.mockResolvedValue(response(409, { error: 'Sign-ups are locked.' }));
    await render(); await choose('alt');
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).toContain('You answered Accept');
    expect(host.textContent).toContain('Bringing Redtape');
    expect(host.textContent).toContain('Sign-ups are locked.');
  });

  it('reverts a forbidden switch and shows the server message', async () => {
    fetcher.mockResolvedValue(response(403, { error: 'That character is not yours.' }));
    await render(); await choose('alt');
    expect(select().value).toBe('main');
    expect(host.textContent).toContain('That character is not yours.');
  });

  it('shows the brought character as text when sign-ups are already closed', async () => {
    await render({ raid: card({ status: 'LOCKED' }), broughtId: 'alt' });
    expect(host.querySelector('select')).toBeNull();
    expect(host.textContent).toContain('Bringing Triplicate');
  });
});
