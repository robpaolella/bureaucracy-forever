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
  { id: 'main', name: 'Redtape', wowClass: 'warrior' as const, spec: 'Protection', role: 'tank' as const, isMain: true, level: 60 },
  { id: 'alt', name: 'Triplicate', wowClass: 'mage' as const, spec: 'Frost', role: 'ranged' as const, isMain: false, level: 60 },
];
const card = (over: Partial<RaidCard> = {}): RaidCard => ({
  id: 'raid', name: 'Molten Core', startsAt: '2030-01-01T20:00:00Z', durationMin: 180,
  notes: null, cancelled: false, requirements: { tank: 2, healer: 8, dps: 20 },
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
      defaultCharacterId={null}
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

  it('disables the character selector while a switch is pending', async () => {
    let resolve!: (value: ReturnType<typeof response>) => void;
    fetcher.mockReturnValue(new Promise<ReturnType<typeof response>>((done) => { resolve = done; }));
    await render(); await choose('alt');
    expect(select().disabled).toBe(true);
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

describe('RaidResponseControl character question', () => {
  const dialog = () => host.querySelector('dialog')!;
  const button = (label: string, within: ParentNode = host) => [...within.querySelectorAll('button')].find((b) => b.textContent === label)!;
  const click = (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  const unanswered = { raid: card({ mine: null, signupRole: undefined }), broughtId: null };
  const bodyOf = (call = 0) => JSON.parse(fetcher.mock.calls[call][1].body);

  it.each([['Accept'], ['Tentative']])('asks on a first %s and sends nothing until confirmed', async (label) => {
    await render(unanswered);
    await click(button(label));
    expect(dialog().open).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
    expect((dialog().querySelector('input[type=radio]:checked') as HTMLInputElement).value).toBe('main');
    expect(dialog().textContent).toContain('Molten Core · Tue, Jan 1 · 12:00 PM PST');
    expect(dialog().textContent).toContain('Main');
    expect(dialog().textContent).toContain('Warrior · Protection · Tank');
  });

  it('cancelling writes nothing and keeps the answer', async () => {
    await render(unanswered);
    await click(button('Accept'));
    await click(button('Cancel', dialog()));
    expect(dialog().open).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-checked=true]')).toBeNull();
  });

  it('confirms with the chosen character in one request and no makeDefault when unticked', async () => {
    fetcher.mockResolvedValue(response(200, { raidId: 'raid', userId: 'u', response: 'accept', characterId: 'alt', counts: { tank: 1, healer: 8, melee: 9, ranged: 11 } }));
    await render(unanswered);
    await click(button('Accept'));
    await click(dialog().querySelector('input[value=alt]')!);
    await click(button('Accept', dialog()));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/api/raids/raid/signup');
    expect(bodyOf()).toEqual({ response: 'accept', characterId: 'alt' });
  });

  it('sends makeDefault when ticked, and does not ask again for the next raid answer', async () => {
    fetcher.mockResolvedValue(response(200, { raidId: 'raid', userId: 'u', response: 'tentative', characterId: 'alt', counts: { tank: 1, healer: 8, melee: 9, ranged: 10 } }));
    await render(unanswered);
    await click(button('Tentative'));
    await click(dialog().querySelector('input[type=checkbox]')!);
    await click(button('Tentative', dialog()));
    expect(bodyOf()).toEqual({ response: 'tentative', characterId: 'main', makeDefault: true });
    await click(button('Absent'));
    await click(button('Accept'));
    expect(dialog().open).toBe(false);
    expect(bodyOf(2)).toEqual({ response: 'accept' });
  });

  it('shows the route message and rolls back on a refused write', async () => {
    fetcher.mockResolvedValue(response(400, { error: 'That character is no longer available. Choose another and try again.' }));
    await render(unanswered);
    await click(button('Accept'));
    await click(button('Accept', dialog()));
    expect(host.textContent).toContain('That character is no longer available. Choose another and try again.');
    expect(host.textContent).not.toContain("Couldn't save that");
    expect(host.querySelector('[aria-checked=true]')).toBeNull();
  });

  it.each([
    ['a member with one character', { ...unanswered, characters: [characters[0]] }],
    ['a member with a default', { ...unanswered, defaultCharacterId: 'alt' }],
  ])('does not ask %s', async (_state, props) => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: card().counts }));
    await render(props);
    await click(button('Accept'));
    expect(dialog().open).toBe(false);
    expect(bodyOf()).toEqual({ response: 'accept' });
  });

  it('does not ask for Absent, or when moving between Accept and Tentative', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'tentative', counts: card().counts }));
    await render({ raid: card({ mine: 'accept' }), broughtId: 'main' });
    await click(button('Tentative'));
    expect(dialog().open).toBe(false);
    expect(bodyOf()).toEqual({ response: 'tentative' });
    await render(unanswered);
    await click(button('Absent'));
    expect(dialog().open).toBe(false);
    expect(bodyOf(1)).toEqual({ response: 'absent' });
  });

  it('asks again on Accept after Absent', async () => {
    await render({ raid: card({ mine: 'absent' }) });
    await click(button('Accept'));
    expect(dialog().open).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('Undo restores the answer without a character and never opens the question', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: card().counts }));
    await render({ raid: card({ mine: 'absent' }), broughtId: 'main' });
    await click(button('Accept'));
    await click(button('Accept', dialog()));
    expect(bodyOf()).toEqual({ response: 'accept', characterId: 'main' });
    await click(button('Undo'));
    expect(dialog().open).toBe(false);
    expect(bodyOf(1)).toEqual({ response: 'absent', keepCharacter: true });
  });
});

describe('RaidResponseControl under level 60', () => {
  const dialogs = () => [...host.querySelectorAll('dialog')];
  const openDialog = () => dialogs().find((d) => d.open)!;
  const button = (label: string, within: ParentNode = host) => [...within.querySelectorAll('button')].find((b) => b.textContent === label)!;
  const click = (el: Element) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  const unanswered = { raid: card({ mine: null, signupRole: undefined }), broughtId: null };
  const level = (id: string, value: number | null) => characters.map((c) => (c.id === id ? { ...c, level: value } : c));
  const sent = () => fetcher.mock.calls.map((c) => c[1].body);

  it.each([[59, true], [60, false], [null, false]])('a lone character at level %s asks: %s', async (value, asks) => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: card().counts }));
    await render({ ...unanswered, characters: [{ ...characters[0], level: value }] });
    await click(button('Accept'));
    expect(openDialog() !== undefined).toBe(asks);
    expect(fetcher).toHaveBeenCalledTimes(asks ? 0 : 1);
  });

  it('names the character and level, writes nothing on Cancel, and signs up on Sign up anyway', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'tentative', counts: card().counts }));
    await render({ ...unanswered, characters: [{ ...characters[0], name: 'Grimbo Ash', level: 52 }] });
    await click(button('Tentative'));
    expect(openDialog().textContent).toContain('Grimbo Ash is level 52, not yet 60. Sign up anyway?');
    await click(button('Cancel', openDialog()));
    expect(openDialog()).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
    await click(button('Tentative'));
    await click(button('Sign up anyway', openDialog()));
    expect(sent()).toEqual([JSON.stringify({ response: 'tentative' })]);
  });

  it('asks about the default character, and not when the default is 60', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: card().counts }));
    await render({ ...unanswered, defaultCharacterId: 'alt', characters: level('alt', 40) });
    await click(button('Accept'));
    expect(openDialog().textContent).toContain('Triplicate is level 40');
    await click(button('Cancel', openDialog()));
    await render({ ...unanswered, defaultCharacterId: 'main', characters: level('alt', 40) });
    await click(button('Accept'));
    expect(openDialog()).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not ask for an unknown level, Absent, or Accept to Tentative', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'tentative', counts: card().counts }));
    await render({ raid: card({ mine: 'accept' }), characters: [{ ...characters[0], level: 10 }] });
    await click(button('Tentative'));
    expect(openDialog()).toBeUndefined();
    await render({ ...unanswered, characters: [{ ...characters[0], level: 10 }] });
    await click(button('Absent'));
    expect(openDialog()).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('combines with the character question: levels on cards, a warning and Sign up anyway', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: card().counts }));
    await render({ ...unanswered, characters: [{ ...characters[0], level: 60 }, { ...characters[1], name: 'Grimbo Ash', level: 52 }, { ...characters[1], id: 'third', name: 'Mystery Alt', level: null }] });
    await click(button('Accept'));
    const dialog = openDialog();
    expect(dialog.textContent).toContain('Warrior · Protection · Tank · Level 60');
    expect(dialog.textContent).toContain('Level unknown');
    expect(dialog.textContent).not.toContain('not yet 60');
    expect(button('Accept', dialog)).toBeDefined();
    await click(dialog.querySelector('input[value=alt]')!);
    expect(dialog.textContent).toContain('Grimbo Ash is level 52, not yet 60.');
    expect(button('Accept', dialog)).toBeUndefined();
    await click(button('Sign up anyway', dialog));
    expect(JSON.parse(sent()[0])).toEqual({ response: 'accept', characterId: 'alt' });
    expect(dialogs().filter((d) => d.open)).toHaveLength(0);
  });

  it('asks on a switch of Bringing to an under-60 character; Keep writes nothing, Bring switches', async () => {
    fetcher.mockResolvedValue(response());
    await render({ characters: level('alt', 52) });
    await choose('alt');
    expect(openDialog().textContent).toContain('Triplicate is level 52, not yet 60. Bring Triplicate anyway?');
    expect(select().value).toBe('main');
    await click(button('Keep Redtape', openDialog()));
    expect(fetcher).not.toHaveBeenCalled();
    expect(select().value).toBe('main');
    await choose('alt');
    await click(button('Bring Triplicate', openDialog()));
    expect(fetcher).toHaveBeenCalledWith('/api/raids/raid/signup/character', expect.objectContaining({ body: JSON.stringify({ characterId: 'alt' }) }));
  });

  it.each([[60], [null]])('does not ask on a switch to a level %s character', async (value) => {
    fetcher.mockResolvedValue(response());
    await render({ characters: level('alt', value) });
    await choose('alt');
    expect(openDialog()).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
