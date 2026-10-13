// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOT_LOG } from '@/content/loot-log';
import type { ItemView } from '@/lib/loot-items';
import { INVALID_DELAY_MS, LOOKUP_DELAY_MS, UnlistedDrop } from './UnlistedDrop';

const LINK = 'https://www.wowhead.com/forever/item=231044/whelp-scale-bracers';
const item: ItemView = { id: 231044, name: 'Whelp-Scale Bracers', quality: 4, icon: 'inv_bracer', tooltipHtml: '' };
const copy = LOOT_LOG.unlisted;
const onFound = vi.fn(), onOnTable = vi.fn(), fetcher = vi.fn();
const answer = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body });
let root: Root, host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset();
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const render = () => act(async () => root.render(<UnlistedDrop raidId="raid" disabled={false} bossName="Onyxia" onFound={onFound} onOnTable={onOnTable} />));
const input = () => host.querySelector('input')!;
const type = async (value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
  input().dispatchEvent(new Event('input', { bubbles: true }));
});
const settle = async (ms = LOOKUP_DELAY_MS) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const lookup = async (value: string) => { await type(value); await settle(INVALID_DELAY_MS); };

describe('UnlistedDrop', () => {
  it('moves focus to the box, labelled with the hint', async () => {
    await render();
    expect(document.activeElement).toBe(input());
    expect(host.textContent).toContain(copy.refLabel); expect(host.textContent).toContain(copy.refHint);
    expect(input().placeholder).toBe(copy.refPlaceholder);
  });

  it('does not look up an empty or invalid value, and says it is not a Forever link', async () => {
    await render();
    await lookup('');
    await lookup('wowhead.com/for');
    await lookup('https://www.wowhead.com/classic/item=19019');
    expect(fetcher).not.toHaveBeenCalled();
    expect(host.textContent).toContain(copy.notForever);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('[role="status"]')!.textContent).toContain(copy.notForever);
    expect(input().getAttribute('aria-describedby')).toBe(host.querySelector('span[id$="-note"]')!.id);
  });

  it('gives half-typed text longer before calling it not a Forever link', async () => {
    await render();
    await type('wowhead.com/for'); await settle();
    expect(host.textContent).not.toContain(copy.notForever);
    await settle(INVALID_DELAY_MS - LOOKUP_DELAY_MS);
    expect(host.textContent).toContain(copy.notForever);
  });

  it('waits for a pause in typing, then shows the lookup and the found item', async () => {
    let resolve!: (v: unknown) => void;
    fetcher.mockReturnValue(new Promise((r) => { resolve = r; }));
    await render();
    await type('231044'); await act(async () => { await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS - 1); });
    expect(fetcher).not.toHaveBeenCalled();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('/api/raids/raid/loot/lookup?item=231044');
    expect(host.textContent).toContain(copy.looking);
    await act(async () => resolve(answer(200, { item, onTable: [] })));
    expect(host.textContent).not.toContain(copy.looking);
    expect(host.textContent).toContain('Whelp-Scale Bracers'); expect(host.textContent).toContain('#231044');
    expect(host.textContent).toContain(`${copy.newBefore}Onyxia${copy.newAfter}`);
    expect(onFound).toHaveBeenCalledWith(item);
    await type(`${LINK}x`);
    expect(onFound).toHaveBeenLastCalledWith(null);
  });

  it('hands an item that is already on the table to the log', async () => {
    const onTable = [{ bossId: 'b2', bossName: 'Trash' }];
    fetcher.mockResolvedValue(answer(200, { item, onTable }));
    await render(); await lookup(LINK);
    expect(onOnTable).toHaveBeenCalledWith(item, onTable);
    expect(onFound).not.toHaveBeenCalled();
  });

  it('ignores a late answer for an earlier value', async () => {
    let first!: (v: unknown) => void;
    fetcher.mockReturnValueOnce(new Promise((r) => { first = r; })).mockResolvedValueOnce(answer(404, { error: 'x', code: 'not-found' }));
    await render(); await lookup('231044'); await lookup('999999');
    expect(host.textContent).toContain(copy.notFound(999999));
    await act(async () => first(answer(200, { item, onTable: [] })));
    expect(onFound).not.toHaveBeenCalled();
    expect(host.textContent).toContain(copy.notFound(999999)); expect(host.textContent).not.toContain('Whelp-Scale Bracers');
  });

  it.each([
    ['not-forever', 400, copy.notForever],
    ['not-found', 404, copy.notFound(231044)],
  ])('shows the %s answer in the design’s words', async (code, status, text) => {
    fetcher.mockResolvedValue(answer(status, { error: 'server wording', code }));
    await render(); await lookup('231044');
    expect(host.textContent).toContain(text); expect(host.textContent).not.toContain('server wording');
    expect(host.textContent).not.toContain(copy.retry);
  });

  it('offers Try again when Wowhead does not answer, and retries the lookup', async () => {
    fetcher.mockResolvedValueOnce(answer(502, { error: 'x', code: 'wowhead-down' })).mockResolvedValueOnce(answer(200, { item, onTable: [] }));
    await render(); await lookup('231044');
    expect(host.textContent).toContain(copy.down);
    await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent === copy.retry)!.click(); });
    expect(host.textContent).toContain(copy.looking);
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onFound).toHaveBeenCalledWith(item);
    expect(host.textContent).not.toContain(copy.down);
  });

  it('treats a failed request as Wowhead not answering', async () => {
    fetcher.mockRejectedValue(new Error('offline'));
    await render(); await lookup('231044');
    expect(host.textContent).toContain(copy.down);
  });
});
