// @vitest-environment happy-dom
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZERO_COUNTS, type RaidCard } from '@/lib/raids';
import { useSignup, type CharacterSwitchResult } from './useSignup';

const card = (over: Partial<RaidCard> = {}): RaidCard => ({
  id: 'raid', name: 'MC', startsAt: '2030-01-01T20:00:00Z', durationMin: 180,
  notes: null, cancelled: false, requirements: { tank: 0, healer: 0, dps: 0 },
  counts: { ...ZERO_COUNTS, healer: 2 }, mine: 'accept', signupRole: 'healer', onRoster: true, ...over,
});
const character = { id: 'alt', name: 'Triplicate', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' };
const removed = [{ kind: 'HR', itemId: 1, itemName: 'Blade', reason: 'Already won.' }];
const response = (status = 200, body: unknown = { character, removed }) => ({ ok: status < 400, status, json: async () => body });
const fetcher = vi.fn(), onResult = vi.fn();
let root: Root, host: HTMLDivElement, hook: ReturnType<typeof useSignup>;
const defaults = { characters: [{ id: 'main', role: 'healer' as const }, { id: 'alt', role: 'ranged' as const }], defaultId: 'alt' };
function Harness({ initial, withDefault = false }: { initial: RaidCard[]; withDefault?: boolean }) {
  const state = useSignup(initial, 'healer', onResult, withDefault ? defaults : undefined);
  useLayoutEffect(() => { hook = state; });
  return null;
}
const render = async (initial = [card()], withDefault = false) => act(async () => root.render(<Harness initial={initial} withDefault={withDefault} />));
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

  it('Undo sends an answer-only request (keepCharacter); a normal answer does not', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'absent', counts: ZERO_COUNTS }));
    await render();
    await act(async () => { hook.respond('raid', 'absent'); });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ response: 'absent' });
    fetcher.mockResolvedValue(response(200, { response: 'accept', counts: ZERO_COUNTS }));
    await act(async () => { hook.undo('raid'); });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ response: 'accept', keepCharacter: true });
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

describe('useSignup DPS counts', () => {
  const dps = () => hook.raids[0].counts.melee + hook.raids[0].counts.ranged;
  it.each(['melee', 'ranged'] as const)('adds a %s answer to DPS at once and rolls it back when the request fails', async (role) => {
    const request = deferred(); fetcher.mockReturnValue(request.promise);
    await render([card({ mine: null, signupRole: role, counts: { ...ZERO_COUNTS, ranged: 3 } })]);
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(dps()).toBe(4);
    await act(async () => { request.reject(new Error('offline')); });
    expect(dps()).toBe(3);
  });

  it.each(['melee', 'ranged'] as const)('removes a %s member from DPS on withdrawing', async (role) => {
    fetcher.mockReturnValue(deferred().promise);
    await render([card({ mine: 'accept', signupRole: role, counts: { ...ZERO_COUNTS, melee: 2, ranged: 2 } })]);
    await act(async () => { hook.respond('raid', 'absent'); });
    expect(dps()).toBe(3);
  });

  it('moves the count from DPS to healers when switching to a healer', async () => {
    fetcher.mockResolvedValue(response(200, { character: { ...character, raidRole: 'HEALER' }, removed: [] }));
    await render([card({ signupRole: 'ranged', counts: { ...ZERO_COUNTS, ranged: 3, healer: 1 } })]);
    await act(async () => { await hook.switchCharacter('raid', 'alt', 'healer'); });
    expect(dps()).toBe(2);
    expect(hook.raids[0].counts.healer).toBe(2);
  });
});

describe('useSignup character choice', () => {
  const choice = { characterId: 'alt', role: 'ranged' as const, makeDefault: false };
  it('sends characterId, and makeDefault only when ticked', async () => {
    fetcher.mockResolvedValue(response(200, { response: 'accept', characterId: 'alt', counts: { ...ZERO_COUNTS, ranged: 1 } }));
    await render([card({ mine: null, signupRole: 'healer' })]);
    await act(async () => { hook.respond('raid', 'accept', true, choice); });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ response: 'accept', characterId: 'alt' });
    expect(hook.madeDefault).toBeNull();
    await act(async () => { hook.respond('raid', 'tentative', true, { ...choice, makeDefault: true }); });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ response: 'tentative', characterId: 'alt', makeDefault: true });
    expect(hook.madeDefault).toBe('alt');
  });

  it('counts the chosen role at once and hands the route message to onResult on a refusal', async () => {
    const request = deferred(); fetcher.mockReturnValue(request.promise);
    await render([card({ mine: null, signupRole: 'healer', counts: { ...ZERO_COUNTS, healer: 2 } })]);
    await act(async () => { hook.respond('raid', 'accept', true, choice); });
    expect(hook.raids[0]).toMatchObject({ mine: 'accept', signupRole: 'ranged', counts: { healer: 2, ranged: 1 } });
    await act(async () => { request.resolve(response(400, { error: 'That character is no longer available. Choose another and try again.' })); });
    expect(hook.raids[0]).toEqual(card({ mine: null, signupRole: 'healer', counts: { ...ZERO_COUNTS, healer: 2 } }));
    expect(onResult).toHaveBeenCalledWith(false, expect.anything(), 'accept', expect.any(Function), false, 'That character is no longer available. Choose another and try again.');
    expect(hook.madeDefault).toBeNull();
  });

  it('leaves the message out for a network failure so the caller shows its generic copy', async () => {
    fetcher.mockRejectedValue(new Error('offline'));
    await render([card({ mine: null })]);
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(onResult).toHaveBeenCalledWith(false, expect.anything(), 'accept', expect.any(Function), false, undefined);
  });

  it('remembers a saved default even when a newer answer on the raid supersedes its reply', async () => {
    const first = deferred(), second = deferred();
    fetcher.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await render([card({ mine: null })]);
    await act(async () => { hook.respond('raid', 'accept', true, { ...choice, makeDefault: true }); });
    await act(async () => { hook.respond('raid', 'absent'); });
    await act(async () => { first.resolve(response(200, { response: 'accept', characterId: 'alt', counts: ZERO_COUNTS })); });
    expect(hook.madeDefault).toBe('alt');
    await act(async () => { second.resolve(response(200, { response: 'absent', counts: ZERO_COUNTS })); });
  });
});

describe('useSignup default character', () => {
  const unanswered = () => card({ mine: null, signupRole: 'healer', counts: { ...ZERO_COUNTS, healer: 2 } });
  const reply = (r: string | null, role: string | null, counts: object) => response(200, { response: r, characterId: role === 'ranged' ? 'alt' : 'main', role, counts: { ...ZERO_COUNTS, ...counts } });

  it('counts a first Accept under the default role, keeps it after the reply, and moves that role on Tentative then Absent', async () => {
    await render([unanswered()], true);
    const first = deferred(); fetcher.mockReturnValueOnce(first.promise);
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(hook.raids[0]).toMatchObject({ mine: 'accept', signupRole: 'ranged', counts: { healer: 2, ranged: 1 } });
    await act(async () => { first.resolve(reply('accept', 'ranged', { healer: 2, ranged: 1 })); });
    expect(hook.raids[0]).toMatchObject({ signupRole: 'ranged', counts: { healer: 2, ranged: 1 } });

    const second = deferred(); fetcher.mockReturnValueOnce(second.promise);
    await act(async () => { hook.respond('raid', 'tentative'); });
    expect(hook.raids[0]).toMatchObject({ mine: 'tentative', counts: { healer: 2, ranged: 0 } });
    await act(async () => { second.resolve(reply('tentative', 'ranged', { healer: 2 })); });
    expect(hook.raids[0]).toMatchObject({ signupRole: 'ranged', counts: { healer: 2, ranged: 0 } });

    const third = deferred(); fetcher.mockReturnValueOnce(third.promise);
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(hook.raids[0]).toMatchObject({ mine: 'accept', counts: { healer: 2, ranged: 1 } });
    await act(async () => { third.resolve(reply('accept', 'ranged', { healer: 2, ranged: 1 })); });
    expect(hook.raids[0]).toMatchObject({ mine: 'accept', signupRole: 'ranged', counts: { healer: 2, ranged: 1 } });

    const fourth = deferred(); fetcher.mockReturnValueOnce(fourth.promise);
    await act(async () => { hook.respond('raid', 'absent'); });
    expect(hook.raids[0]).toMatchObject({ mine: 'absent', counts: { healer: 2, ranged: 0 } });
    await act(async () => { fourth.resolve(reply('absent', 'ranged', { healer: 2 })); });
    expect(hook.raids[0]).toMatchObject({ mine: 'absent', signupRole: 'ranged', counts: { healer: 2, ranged: 0 } });
  });

  it('takes the role from the reply when the guess was wrong', async () => {
    await render([unanswered()]);
    fetcher.mockResolvedValue(reply('accept', 'ranged', { healer: 2, ranged: 1 }));
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(hook.raids[0]).toMatchObject({ signupRole: 'ranged' });
  });

  it('puts the earlier answer, role and counts back when refused', async () => {
    await render([unanswered()], true);
    fetcher.mockResolvedValue(response(409, { error: 'Locked.' }));
    await act(async () => { hook.respond('raid', 'accept'); });
    expect(hook.raids[0]).toEqual(unanswered());
  });

  it('leaves Undo and an answered row on their brought character', async () => {
    await render([card({ mine: 'accept', signupRole: 'healer' })], true);
    fetcher.mockResolvedValue(reply('tentative', 'healer', { healer: 1 }));
    await act(async () => { hook.respond('raid', 'tentative'); });
    expect(hook.raids[0]).toMatchObject({ signupRole: 'healer', counts: { healer: 1, ranged: 0 } });
  });
});
