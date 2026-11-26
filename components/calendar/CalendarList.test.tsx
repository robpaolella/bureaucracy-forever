// @vitest-environment happy-dom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RaidCard } from '@/lib/raids';
import { CalendarList } from './CalendarList';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/time/useViewerTimeZone', () => ({ useViewerTimeZone: () => null }));
vi.mock('@/components/loot/ReserveWindow', () => ({ useReservePrompt: () => ({ afterAnswer: async () => false, window: null }) }));

const characters = [
  { id: 'main', name: 'Redtape', wowClass: 'warrior' as const, spec: 'Protection', role: 'tank' as const, isMain: true, level: 60 },
  { id: 'alt', name: 'Triplicate', wowClass: 'mage' as const, spec: 'Frost', role: 'ranged' as const, isMain: false, level: 60 },
];
const raid: RaidCard = {
  id: 'raid', name: 'Molten Core', startsAt: '2099-01-01T20:00:00Z', durationMin: 180, notes: null, cancelled: false,
  requirements: { tank: 2, healer: 8, dps: 20 }, counts: { tank: 0, healer: 0, melee: 0, ranged: 0 }, mine: null, onRoster: true, status: 'SCHEDULED', locksAt: '2099-01-01T19:00:00Z',
};
const fetcher = vi.fn();
let root: Root, host: HTMLDivElement;
const render = (over: Partial<ComponentProps<typeof CalendarList>> = {}) => act(async () => root.render(
  <CalendarList raids={[raid]} viewer={{ role: 'member', raidRole: 'tank', availabilitySubmitted: true }} characters={characters} defaultCharacterId={null} {...over} />,
));
const button = (label: string, within: ParentNode = host) => [...within.querySelectorAll('button')].find((b) => b.textContent === label)!;
const click = (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('CalendarList character question', () => {
  it('opens from a row, writes nothing on Cancel, and sends the character on confirm', async () => {
    fetcher.mockResolvedValue({ ok: true, status: 200, json: async () => ({ response: 'tentative', characterId: 'alt', counts: raid.counts }) });
    await render();
    await click(button('Tentative'));
    const dialog = host.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Molten Core');
    await click(button('Cancel', dialog));
    expect(dialog.open).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    await click(button('Tentative'));
    await click(dialog.querySelector('input[value=alt]')!);
    await click(button('Tentative', dialog));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ response: 'tentative', characterId: 'alt' });
  });

  it('does not ask a member with a default, and shows the route message on a refusal', async () => {
    fetcher.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'Sign-ups are locked.' }) });
    await render({ defaultCharacterId: 'alt' });
    await click(button('Accept'));
    expect(host.querySelector('dialog')!.open).toBe(false);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ response: 'accept' });
    expect(host.textContent).toContain('Sign-ups are locked.');
  });
});
