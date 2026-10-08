// @vitest-environment happy-dom
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZERO_COUNTS, type RaidCard } from '@/lib/raids';
import { useSignup, type CharacterSwitchResult } from './useSignup';

const card = (over: Partial<RaidCard> = {}): RaidCard => ({
  id: 'raid', name: 'MC', startsAt: '2030-01-01T20:00:00Z', durationMin: 180,
  notes: null, cancelled: false, requirements: ZERO_COUNTS,
  counts: { ...ZERO_COUNTS, healer: 2 }, mine: 'accept', signupRole: 'healer', onRoster: true, ...over,
});
const character = { id: 'alt', name: 'Triplicate', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' };
const removed = [{ kind: 'HR', itemId: 1, itemName: 'Blade', reason: 'Already won.' }];
const response = (status = 200, body: unknown = { character, removed }) => ({ ok: status < 400, status, json: async () => body });
const fetcher = vi.fn(), onResult = vi.fn();
let root: Root, host: HTMLDivElement, hook: ReturnType<typeof useSignup>;
function Harness({ initial }: { initial: RaidCard[] }) {
  const state = useSignup(initial, 'healer', onResult);
  useLayoutEffect(() => { hook = state; });
  return null;
}
const render = async (initial = [card()]) => act(async () => root.render(<Harness initial={initial} />));
function deferred() {
  let resolve!: (value: ReturnType<typeof response>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<ReturnType<typeof response>>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('useSignup character switches', () => {
  it('moves counts immediately, returns removed reserves and waits for the server role on refresh', async () => {
    const request = deferred(); fetcher.mockReturnValue(request.promise);
    await render();
    let switched!: Promise<CharacterSwitchResult>;
    await act(async () => { switched = hook.switchCharacter('raid', 'alt', 'ranged'); });
    expect(hook.raids[0]).toMatchObject({ mine: 'accept', signupRole: 'ranged', counts: { healer: 1, ranged: 1 } });
    expect(hook.pending.has('raid')).toBe(true);
    expect(fetcher).toHaveBeenCalledWith('/api/raids/raid/signup/character', expect.objectContaining({
      method: 'PUT', body: JSON.stringify({ characterId: 'alt' }), credentials: 'same-origin',
    }));
    await act(async () => { request.resolve(response()); expect(await switched).toEqual({ ok: true, character, removed }); });
    expect(hook.pending.size).toBe(0);
    await render(); // An old server response must not discard the switched role.
    expect(hook.raids[0].counts).toEqual({ ...ZERO_COUNTS, healer: 1, ranged: 1 });
    const fresh = card({ signupRole: 'ranged', counts: { ...ZERO_COUNTS, ranged: 4 } });
    await render([fresh]);
    expect(hook.raids[0]).toBe(fresh);
    expect(onResult).not.toHaveBeenCalled();
  });

  it.each([403, 409])('reverts counts and returns a %s server refusal', async (status) => {
    const request = deferred(); fetcher.mockReturnValue(request.promise);
    await render();
    let switched!: Promise<CharacterSwitchResult>;
    await act(async () => { switched = hook.switchCharacter('raid', 'alt', 'ranged'); });
    expect(hook.raids[0].signupRole).toBe('ranged');
    const error = status === 409 ? 'Sign-ups are locked.' : 'That character is not yours.';
    await act(async () => {
      request.resolve(response(status, { error }));
      expect(await switched).toEqual({ ok: false, status, error });
    });
    expect(hook.raids[0]).toEqual(card());
    expect(hook.pending.size).toBe(0);
  });

  it('retains an HTTP error status even when the reply is not JSON', async () => {
    fetcher.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('HTML'); } });
    await render();
    await act(async () => { expect(await hook.switchCharacter('raid', 'alt', 'ranged')).toMatchObject({ ok: false, status: 502 }); });
    expect(hook.raids[0]).toEqual(card());
    expect(hook.pending.size).toBe(0);
  });

  it('does not pin a guessed role on a first answer with no signup role', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: { ...ZERO_COUNTS, healer: 3 } }));
    await render([card({ mine: null, signupRole: undefined })]);
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(hook.raids[0].counts.healer).toBe(3);
    const fresh = card({ signupRole: 'ranged', counts: { ...ZERO_COUNTS, ranged: 4 } });
    await render([fresh]);
    expect(hook.raids[0]).toBe(fresh);
  });

  it('reverts a network failure and allows a retry', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response());
    await render();
    await act(async () => { expect(await hook.switchCharacter('raid', 'alt', 'ranged')).toMatchObject({ ok: false, status: null }); });
    expect(hook.raids[0]).toEqual(card());
    await act(async () => { expect(await hook.switchCharacter('raid', 'alt', 'ranged')).toMatchObject({ ok: true }); });
    expect(hook.raids[0].signupRole).toBe('ranged');
  });

  it.each([{ mine: 'tentative' as const }, { onRoster: false }])('does not move counts for an uncounted signup: %o', async (over) => {
    fetcher.mockResolvedValue(response());
    await render([card(over)]);
    await act(async () => { await hook.switchCharacter('raid', 'alt', 'ranged'); });
    expect(hook.raids[0].counts).toEqual(card().counts);
    expect(hook.raids[0].signupRole).toBe('ranged');
  });

  it('uses the confirmed role for later answers, their rollback, and undo', async () => {
    fetcher.mockResolvedValueOnce(response());
    await render();
    await act(async () => { await hook.switchCharacter('raid', 'alt', 'ranged'); });
    const request = deferred(); fetcher.mockReturnValueOnce(request.promise);
    await act(async () => { hook.respond('raid', 'absent'); });
    expect(hook.raids[0].counts).toEqual({ ...ZERO_COUNTS, healer: 1 });
    await act(async () => { request.reject(new Error('offline')); });
    expect(hook.raids[0]).toMatchObject({ mine: 'accept', signupRole: 'ranged', counts: { healer: 1, ranged: 1 } });
    fetcher.mockResolvedValueOnce(response(200, { response: 'absent', counts: { ...ZERO_COUNTS, healer: 1 } }));
    await act(async () => { hook.respond('raid', 'absent'); });
    expect(hook.raids[0].signupRole).toBe('ranged');
    const undoRequest = deferred(); fetcher.mockReturnValueOnce(undoRequest.promise);
    await act(async () => { hook.undo('raid'); });
    expect(hook.raids[0].counts).toEqual({ ...ZERO_COUNTS, healer: 1, ranged: 1 });
    await act(async () => { undoRequest.resolve(response(200, { response: 'accept', counts: hook.raids[0].counts })); });
  });

  it('prevents overlapping switches and answers on the same raid', async () => {
    const request = deferred(); fetcher.mockReturnValue(request.promise);
    await render();
    await act(async () => {
      void hook.switchCharacter('raid', 'alt', 'ranged');
      hook.respond('raid', 'absent');
      expect(await hook.switchCharacter('raid', 'main', 'healer')).toMatchObject({ ok: false });
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => { request.resolve(response()); });
    const answer = deferred(); fetcher.mockReturnValue(answer.promise);
    await act(async () => { hook.respond('raid', 'tentative'); });
    await act(async () => { expect(await hook.switchCharacter('raid', 'main', 'healer')).toMatchObject({ ok: false }); });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await act(async () => { answer.resolve(response(200, { response: 'tentative', counts: { ...ZERO_COUNTS, healer: 1 } })); });
    expect(hook.pending.size).toBe(0);
  });
});
