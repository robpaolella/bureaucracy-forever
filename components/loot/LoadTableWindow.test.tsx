// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import type { ApplyResult, LoadFile, PreviewResult } from '@/lib/loot-load-client';
import { LoadTableWindow } from './LoadTableWindow';

const client = vi.hoisted(() => ({ readLoadFile: vi.fn(), previewLoadTable: vi.fn(), applyLoadTable: vi.fn() }));
vi.mock('@/lib/loot-load-client', async (real) => ({ ...(await real<object>()), ...client }));

const loadFile: LoadFile = {
  name: 'molten-core.json', total: 6,
  file: { bosses: [{ name: 'Lucifron', isTrash: false, itemIds: [1, 2, 3] }, { name: 'Trash', isTrash: true, itemIds: [4, 5, 6] }], skipped: [] },
};
const ready = (failed: number[] = [6], added = 4): PreviewResult => ({
  kind: 'preview', nothingToChange: added === 0, failed: failed.map((id) => ({ id, error: 'Not found' })),
  items: [{ id: 2, name: 'Ashen Signet', quality: 4, icon: 'inv_ring' }],
  preview: { token: 'tok', added, newBosses: 1, bosses: [
    { bossId: 'b1', name: 'Lucifron', isTrash: false, isNew: false, add: [2, 3], already: [1], notFound: [] },
    { bossId: 'b9', name: 'Test boss', isTrash: false, isNew: false, add: [], already: [], notFound: [] },
    { bossId: null, name: 'Trash', isTrash: true, isNew: true, add: [4, 5], already: [], notFound: failed },
  ] },
});

let root: Root, host: HTMLDivElement;
const onClose = vi.fn(), onLoaded = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  client.readLoadFile.mockResolvedValue({ ok: true, value: loadFile });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

const render = async () => act(async () => root.render(
  <ToastHost><LoadTableWindow open onClose={onClose} templateId="mc" templateName="Molten Core" onLoaded={onLoaded} /></ToastHost>,
));
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === text);
const click = async (text: string) => act(async () => { button(text)!.click(); });
const choose = async () => act(async () => {
  const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: [new File(['{}'], 'molten-core.json')] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
const toasts = () => [...host.querySelectorAll('[role="status"]')].map((t) => t.textContent);
const toPreview = async (result = ready()) => {
  client.previewLoadTable.mockResolvedValueOnce(result);
  await render(); await choose(); await click('Preview');
};

describe('LoadTableWindow step 1', () => {
  it('keeps Preview disabled until a valid file is chosen', async () => {
    await render();
    expect(host.textContent).toContain('No file chosen');
    expect(button('Preview')!.disabled).toBe(true);
    await choose();
    expect(host.textContent).toContain('molten-core.json');
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('shows the file-invalid reason and keeps Preview disabled', async () => {
    const reason = 'This file isn’t a loot list: “Ragnaros” needs “items”: a list of item ids.';
    client.readLoadFile.mockResolvedValue({ ok: false, error: reason });
    await render(); await choose();
    expect(host.querySelector('[role="alert"]')!.textContent).toBe(reason);
    expect(button('Preview')!.disabled).toBe(true);
  });

  it('shows a route error in the same slot with Preview enabled', async () => {
    client.previewLoadTable.mockResolvedValue({ kind: 'error', error: "Couldn't reach the site — try again." });
    await render(); await choose(); await click('Preview');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe("Couldn't reach the site — try again.");
    expect(button('Preview')!.disabled).toBe(false);
    expect(host.textContent).not.toMatch(/\b[45]\d\d\b/);
  });
});

describe('LoadTableWindow fetching', () => {
  it('follows progress, and Stop returns to step 1 with the stopped message', async () => {
    let report!: (p: { completed: number; total: number }) => void;
    let finish!: (r: PreviewResult) => void;
    let stopped!: () => boolean;
    client.previewLoadTable.mockImplementation((options) => {
      report = options.onProgress; stopped = options.stopped;
      return new Promise((resolve) => { finish = resolve; });
    });
    await render(); await choose(); await click('Preview');
    await act(async () => report({ completed: 3, total: 6 }));
    expect(host.textContent).toContain('Fetching items from Wowhead: 3 of 6');
    const bar = host.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuetext')).toBe('3 of 6');
    await click('Stop');
    expect(stopped()).toBe(true);
    // Step 1 shows at once; the batch in flight answers later and is ignored.
    expect(host.textContent).toContain('Stopped. Nothing was loaded.');
    await act(async () => finish(ready()));
    expect(host.textContent).toContain('Stopped. Nothing was loaded.Items fetched so far are saved, so the next try is quicker.');
    expect(button('Preview')!.disabled).toBe(false);
    expect(client.applyLoadTable).not.toHaveBeenCalled();
  });
});

describe('LoadTableWindow preview', () => {
  it('renders the merge preview by boss in file order, with not-found ids', async () => {
    await toPreview();
    const text = host.textContent!;
    expect(text).toContain('Adds 4 items: 1 new boss and 1 boss already on the table. Nothing is removed.');
    expect(text).toContain('Wowhead couldn’t find 1 item');
    expect(text).toContain('Trash: #6');
    expect(text).toContain('Lucifron2 new · 1 already on the table');
    expect(text).toContain('TrashNew bossTrash2 new · 1 not found');
    expect(text).not.toContain('Test boss');
    expect(text).toContain('Ashen Signet');
    expect(text).toContain('From molten-core.json · merge');
    expect(button('Load 4 items')).toBeDefined();
  });

  it('Try again calls preview again; the list follows the result', async () => {
    await toPreview(ready([6]));
    client.previewLoadTable.mockResolvedValueOnce(ready([], 5));
    await click('Try again');
    expect(client.previewLoadTable).toHaveBeenCalledTimes(2);
    expect(host.textContent).not.toContain('couldn’t find');
    expect(button('Load 5 items')).toBeDefined();
  });

  it('Try again with the same ids missing says so and keeps the preview', async () => {
    await toPreview(ready([6]));
    client.previewLoadTable.mockResolvedValueOnce(ready([6]));
    await click('Try again');
    expect(toasts()).toContain('Wowhead still couldn’t find 1 item.');
    expect(host.textContent).toContain('Trash: #6');
  });

  it('moves focus into each new step so it never drops to the page', async () => {
    await toPreview();
    expect(document.activeElement?.textContent).toContain('Adds 4 items');
    await click('Back');
    expect(document.activeElement?.textContent).toBe('Choose file');
  });

  it('lists only bosses with something to add or not found', async () => {
    const result = ready([]) as Extract<PreviewResult, { kind: 'preview' }>;
    result.preview.bosses[0] = { ...result.preview.bosses[0], add: [], already: [1, 2, 3] };
    await toPreview(result);
    expect(host.textContent).toContain('1 boss already on the table');
    expect(host.querySelectorAll('h4')).toHaveLength(1);
    expect(host.querySelector('h4')!.textContent).toBe('Trash');
  });

  it('keeps the not-found box and Try again above nothing to change', async () => {
    await toPreview(ready([6], 0));
    expect(host.textContent).toContain('Wowhead couldn’t find 1 itemThey won’t be loaded.');
    expect(host.textContent).toContain('Trash: #6');
    expect(host.textContent).toContain('Nothing to change');
    client.previewLoadTable.mockResolvedValueOnce(ready([6], 0));
    await click('Try again');
    expect(toasts()).toContain('Wowhead still couldn’t find 1 item.');
  });

  it('says nothing to change with no confirm', async () => {
    await toPreview(ready([], 0));
    expect(host.textContent).toContain('Nothing to changeThe table already matches this file.');
    expect(button('Close')).toBeDefined();
    expect([...host.querySelectorAll('button')].some((b) => b.textContent?.startsWith('Load '))).toBe(false);
  });
});

describe('LoadTableWindow confirm', () => {
  const applying = (...results: ApplyResult[]) => results.forEach((r) => client.applyLoadTable.mockResolvedValueOnce(r));

  it('loads, closes and tells the page', async () => {
    await toPreview(); applying({ kind: 'success', added: 4, newBosses: 1 });
    await click('Load 4 items');
    expect(client.applyLoadTable).toHaveBeenCalledWith({ templateId: 'mc', loadFile, token: 'tok' });
    expect(onClose).toHaveBeenCalledOnce(); expect(onLoaded).toHaveBeenCalledOnce();
    expect(toasts()).toContain('Loaded molten-core.json: added 4 items.');
  });

  it('stays open while saving, so a late success still reports and refreshes', async () => {
    await toPreview();
    let finish!: (r: ApplyResult) => void;
    client.applyLoadTable.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    await click('Load 4 items');
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
    expect(onClose).not.toHaveBeenCalled();
    expect(button('Try again')!.disabled).toBe(true);
    await act(async () => finish({ kind: 'success', added: 4, newBosses: 1 }));
    expect(onClose).toHaveBeenCalledOnce(); expect(onLoaded).toHaveBeenCalledOnce();
    expect(toasts()).toContain('Loaded molten-core.json: added 4 items.');
  });

  it('refuses a stale preview: Cancel / Preview again above the old preview', async () => {
    await toPreview(); applying({ kind: 'stale', error: 'The table changed since this preview.', hint: 'Preview again to see the current changes.' });
    await click('Load 4 items');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('The table changed since this preview.Preview again to see the current changes.');
    expect(button('Cancel')).toBeDefined(); expect(button('Load 4 items')).toBeUndefined();
    client.previewLoadTable.mockResolvedValueOnce(ready());
    await click('Preview again');
    expect(client.previewLoadTable).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('keeps the preview when saving fails, and Retry re-applies with the same token', async () => {
    await toPreview(); applying({ kind: 'save-failed' }, { kind: 'success', added: 4, newBosses: 1 });
    await click('Load 4 items');
    expect(toasts()).toContain('Couldn’t save that — try again.Retry');
    expect(button('Load 4 items')).toBeDefined();
    await click('Retry');
    expect(client.applyLoadTable).toHaveBeenCalledTimes(2);
    expect(client.applyLoadTable.mock.calls[1][0].token).toBe('tok');
    expect(onLoaded).toHaveBeenCalledOnce();
  });

  it('shows a server sentence with no Retry and keeps the preview', async () => {
    await toPreview(); applying({ kind: 'error', error: 'Item ids 2: already cached for Classic.' });
    await click('Load 4 items');
    expect(toasts()).toContain('Item ids 2: already cached for Classic.');
    expect(button('Retry')).toBeUndefined();
    expect(button('Load 4 items')).toBeDefined();
  });
});
