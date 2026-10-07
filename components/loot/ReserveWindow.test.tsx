// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReserveWindowData } from '@/lib/loot-data';
import { ReserveWindow } from './ReserveWindow';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
// Keep the real window, form, select and buttons; replace only the unrelated picker surface.
vi.mock('./ReservePicker', () => ({ ReservePicker: ({ onChange }: { onChange: (kind: string, item: number | null) => void }) => <>
  <button type="button" onClick={() => onChange('HR', 1)}>Pick blade</button>
  <button type="button" onClick={() => onChange('HR', null)}>Clear hard</button>
  <button type="button" onClick={() => onChange('SR', null)}>Clear soft</button>
</> }));
const raid = { id: 'raid', name: 'Molten Core', startsAt: '2030-01-01T20:00:00Z' };
const fixture = (): ReserveWindowData => ({
  table: { bosses: [], blocked: [], items: {} }, reserves: [], lockAt: raid.startsAt, locked: false, cancelled: false,
  targets: [{ userId: 'member', name: 'Redtape', self: true, blockedHr: {},
    characters: [{ id: 'main', name: 'Redtape', wowClass: 'warrior', isMain: true }, { id: 'alt', name: 'Triplicate', wowClass: 'mage', isMain: false }],
    current: { characterId: 'main', hr: 1, sr: 2 } }],
});
let root: Root, host: HTMLDivElement;
const notify = vi.fn(), onClose = vi.fn(), fetcher = vi.fn();
const response = (status = 200, body = {}) => ({ ok: status < 400, status, json: async () => body });
beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
const render = async (data = fixture(), open = true) => act(async () => root.render(<ReserveWindow open={open} onClose={onClose} raid={raid} data={data} notify={notify} />));
const select = () => host.querySelectorAll('select')[host.querySelectorAll('select').length - 1];
const choose = async (value: string) => act(async () => { select().value = value; select().dispatchEvent(new Event('change', { bubbles: true })); });
const click = async (text: string) => act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent === text)!.click(); });
const save = async () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
const body = (index: number) => JSON.parse(fetcher.mock.calls[index][1].body);

describe('ReserveWindow character choice', () => {
  it('labels alts Which character?, defaults to the brought character, and preserves main-only markup', async () => {
    const data = fixture(); data.targets[0].current.characterId = 'alt'; await render(data);
    expect(host.textContent).toContain('Which character?'); expect(select().value).toBe('alt');
    await render(data, false); data.targets[0].characters.pop(); data.targets[0].current.characterId = 'main'; await render(data);
    expect(host.textContent).not.toContain('Which character?'); expect(host.textContent).toContain('Character'); expect(select().value).toBe('main');
  });
  it('saves character and picks together and announces every removed reserve', async () => {
    await render(); await choose('alt'); fetcher.mockResolvedValue(response(200, { removed: [
      { kind: 'HR', itemId: 1, itemName: 'Blade', reason: 'This character already won that item.' },
      { kind: 'SR', itemId: 2, itemName: 'Ring', reason: 'Not open to reserves' },
    ] })); await save();
    expect(fetcher).toHaveBeenCalledTimes(1); expect(body(0)).toEqual({ characterId: 'alt', hr: 1, sr: 2 });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Removed hard reserve on Blade: This character already won that item. Removed soft reserve on Ring: Not open to reserves' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
  });
  it('clears first, then switches, forwarding the officer target to both routes', async () => {
    const data = fixture(); data.targets[0].self = false; await render(data); await choose('alt'); await click('Clear hard'); await click('Clear soft');
    fetcher.mockResolvedValue(response()); await save();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/raids/raid/reserves', '/api/raids/raid/signup/character']);
    expect(body(0)).toEqual({ characterId: 'alt', hr: null, sr: null, forUserId: 'member' });
    expect(body(1)).toEqual({ characterId: 'alt', forUserId: 'member' }); expect(onClose).toHaveBeenCalledOnce();
  });
  it.each([409, 403])('keeps cleared picks but restores the brought character on a second-step %s', async (status) => {
    await render(); await choose('alt'); await click('Clear hard'); await click('Clear soft');
    const error = status === 409 ? 'Sign-ups are locked.' : "That character isn't yours.";
    fetcher.mockResolvedValueOnce(response()).mockResolvedValueOnce(response(status, { error })); await save();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(`Reserves cleared. Character not changed. ${error}`);
    expect(select().value).toBe('main'); expect(select().disabled).toBe(status === 409);
    expect(notify).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled(); expect(refresh).toHaveBeenCalledOnce();
    fetcher.mockResolvedValue(response()); await save(); expect(body(2)).toMatchObject({ characterId: 'main', hr: null, sr: null });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('restores the saved character and makes it read-only on a first-step lock refusal', async () => {
    await render(); await choose('alt'); fetcher.mockResolvedValue(response(409, { error: 'Sign-ups are locked.' })); await save();
    expect(select().value).toBe('main'); expect(select().disabled).toBe(true); expect(host.textContent).toContain('Sign-ups are locked.');
  });
  it('does not switch when clearing fails, and does not treat an unrelated 409 as locked', async () => {
    await render(); await choose('alt'); await click('Clear hard'); await click('Clear soft');
    fetcher.mockResolvedValue(response(409, { error: 'Not open to reserves' })); await save();
    expect(fetcher).toHaveBeenCalledOnce(); expect(select().disabled).toBe(false); expect(host.textContent).toContain('Not open to reserves');
  });
  it('does not call the character route when cleared picks keep the same character', async () => {
    await render(); await click('Clear hard'); await click('Clear soft'); fetcher.mockResolvedValue(response()); await save();
    expect(fetcher).toHaveBeenCalledOnce(); expect(onClose).toHaveBeenCalledOnce();
  });
  it('shows a first-step 403 verbatim and leaves the window open', async () => {
    await render(); fetcher.mockResolvedValue(response(403, { error: "That character isn't yours." })); await save();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("That character isn't yours."); expect(onClose).not.toHaveBeenCalled();
  });
  it('handles a failed second request without announcing success', async () => {
    await render(); await choose('alt'); await click('Clear hard'); await click('Clear soft');
    fetcher.mockResolvedValueOnce(response()).mockRejectedValueOnce(new Error('offline')); await save();
    expect(host.textContent).toContain("Reserves cleared. Couldn't confirm the character change."); expect(onClose).not.toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
  });
});
