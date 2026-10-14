// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOT_LOG } from '@/content/loot-log';
import { ImportAwardsDialog } from './ImportAwardsDialog';

const copy = LOOT_LOG.import;
const items = { 7: { id: 7, name: 'Blade', quality: 4, icon: 'inv', tooltipHtml: '' } };
const fetcher = vi.fn();
const onClose = vi.fn(), onChanged = vi.fn();
const answer = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });
const r = (status: string, extra: object = {}) => ({ id: 'x', type: 'award', status, item: 7, character: 'Gravelstone', ...extra });
let root: Root, host: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const render = (staging = false) => act(async () => root.render(<ImportAwardsDialog open onClose={onClose} raidId="raid" items={items} staging={staging} onChanged={onChanged} />));
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === text)!;
const box = () => host.querySelector('textarea')!;
const type = (value: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box(), value);
  box().dispatchEvent(new Event('input', { bubbles: true }));
});
const importIt = async (reply: unknown) => {
  fetcher.mockResolvedValueOnce(reply);
  await render(); await type('BFLOOT1 text');
  await act(async () => { button(copy.submit).click(); });
};
const error = () => host.querySelector('[role="alert"]')?.textContent;

describe('ImportAwardsDialog paste step', () => {
  it('shows the label and hint, and keeps Import disabled while the box is empty or blank', async () => {
    await render();
    expect(host.querySelector('label')!.textContent).toBe(copy.label);
    expect(host.textContent).toContain(copy.hint);
    expect(button(copy.submit).disabled).toBe(true);
    await type('   ');
    expect(button(copy.submit).disabled).toBe(true);
    await type('BFLOOT1');
    expect(button(copy.submit).disabled).toBe(false);
  });

  it('sends the text to the raid’s import endpoint, with the box disabled while it waits', async () => {
    let finish!: (v: unknown) => void;
    fetcher.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    await render(); await type('BFLOOT1 text');
    await act(async () => { button(copy.submit).click(); });
    expect(fetcher).toHaveBeenCalledWith('/api/raids/raid/loot/import', expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'BFLOOT1 text' }) }));
    expect(box().disabled).toBe(true);
    expect(button(copy.importing)).toBeTruthy();
    expect(button(copy.cancel).disabled).toBe(true);
    await act(async () => finish(answer(200, { results: [r('recorded')] })));
    expect(host.textContent).toContain(copy.imported(1));
  });
});

describe('ImportAwardsDialog results', () => {
  it('shows each status in its own count, with Waiting and its line', async () => {
    await importIt(answer(200, { results: [r('recorded'), r('recorded'), r('replayed'), r('voided'), r('pending'), r('rejected', { code: 'key-conflict' }), r('rejected', { code: 'unknown-character', character: 'Quillfeather' })] }));
    expect(host.textContent).toContain(copy.imported(7));
    const rows = Object.fromEntries([...host.querySelectorAll('ul')[0].querySelectorAll('li')].map((li) => [li.querySelector('span span')?.textContent, li.lastElementChild!.textContent]));
    expect(rows).toEqual({ Recorded: '2', 'Already there': '1', Voided: '1', Refused: '1', 'Not on the site': '1', Waiting: '1' });
    expect(host.textContent).toContain(copy.waitingNote);
    expect(host.textContent).toContain(copy.replayedNote);
    expect(host.textContent).toContain(`Blade · Quillfeather`);
    expect(host.textContent).toContain(copy.unknownNote);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it.each(Object.entries(copy.refusals))('words the refusal %s', async (code, wording) => {
    await importIt(answer(200, { results: [r('recorded'), r('rejected', { code })] }));
    expect(host.textContent).toContain(`Blade · Gravelstone: ${wording}`);
  });

  it('says nothing new, and refreshes nothing, when every award was already there', async () => {
    await importIt(answer(200, { results: [r('replayed'), r('replayed')] }));
    expect(host.textContent).toContain(copy.nothingNew(2));
    expect(host.textContent).not.toContain(copy.counts.recorded);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('names an item the table doesn’t have by its number', async () => {
    await importIt(answer(200, { results: [r('recorded'), r('rejected', { code: 'item-not-in-table', item: 99 })] }));
    expect(host.textContent).toContain(`${copy.itemFallback(99)} · Gravelstone`);
  });

  it('starts over empty with Import more, and closes with Done', async () => {
    await importIt(answer(200, { results: [r('recorded')] }));
    await act(async () => { button(copy.more).click(); });
    expect(box().value).toBe('');
    await importIt(answer(200, { results: [r('recorded')] }));
    await act(async () => { button(copy.done).click(); });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ImportAwardsDialog whole-paste refusals', () => {
  it.each([
    ['wrong-raid', false, copy.wrongRaid],
    ['wrong-environment', false, copy.otherSite('staging')],
    ['wrong-environment', true, copy.otherSite('production')],
    ['unreadable-header', false, copy.unreadable],
    ['no-end-line', false, copy.unreadable],
    ['count-mismatch', false, copy.unreadable],
  ])('%s (staging %s) shows its wording and keeps the text', async (code, staging, wording) => {
    fetcher.mockResolvedValueOnce(answer(400, { error: 'x', code }));
    await render(staging); await type('pasted');
    await act(async () => { button(copy.submit).click(); });
    expect(error()).toBe(wording);
    expect(box().getAttribute('aria-invalid')).toBe('true');
    expect(box().value).toBe('pasted');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('puts the line number only on a malformed line', async () => {
    await importIt(answer(400, { error: 'x', code: 'malformed-line', line: 7 }));
    expect(error()).toBe(copy.unreadableLine(7));
    expect(error()).toContain('(line 7)');
  });

  it('shows the unreadable wording, without a line, for text over the size limit', async () => {
    await importIt(answer(413, { error: 'big' }));
    expect(error()).toBe(copy.unreadable);
  });

  it('clears the error when the text is edited', async () => {
    await importIt(answer(400, { error: 'x', code: 'wrong-raid' }));
    await type('fixed');
    expect(error()).toBeUndefined();
  });
});

describe('ImportAwardsDialog failures', () => {
  it.each([['a server error', answer(500, { error: 'x' })], ['a missing raid', answer(404, { error: 'x' })]])('keeps the window and text after %s', async (_, reply) => {
    await importIt(reply);
    expect(host.textContent).toContain(copy.failedTitle);
    expect(host.textContent).toContain(copy.failedDetail);
    expect(box().value).toBe('BFLOOT1 text');
    expect(button(copy.submit).disabled).toBe(false);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('treats a network failure the same way, and can be pressed again', async () => {
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await render(); await type('BFLOOT1 text');
    await act(async () => { button(copy.submit).click(); });
    expect(host.textContent).toContain(copy.failedTitle);
    fetcher.mockResolvedValueOnce(answer(200, { results: [r('recorded')] }));
    await act(async () => { button(copy.submit).click(); });
    expect(host.textContent).toContain(copy.imported(1));
  });
});
