// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import type { ApplyResult, LoadFile, PreviewResult } from '@/lib/loot-load-client';
import { LoadTableWindow } from './LoadTableWindow';

const client = vi.hoisted(() => ({ readLoadFile: vi.fn(), previewLoadTable: vi.fn(), applyLoadTable: vi.fn(), loadAtlasRaids: vi.fn(), fetchAtlasTable: vi.fn() }));
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

const atlasRaids = [{ key: 'MoltenCore', name: 'Molten Core' }, { key: 'Onyxia', name: 'Onyxia’s Lair' }];
let root: Root, host: HTMLDivElement;
const onClose = vi.fn(), onLoaded = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  client.readLoadFile.mockResolvedValue({ ok: true, value: loadFile });
  client.loadAtlasRaids.mockResolvedValue({ kind: 'ready', source: 'CLASSIC', raids: atlasRaids });
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
    expect(client.applyLoadTable).toHaveBeenCalledWith({ templateId: 'mc', loadFile, token: 'tok', source: 'FOREVER' });
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

describe('LoadTableWindow AtlasLoot', () => {
  const atlasRadio = () => host.querySelector<HTMLInputElement>('input[value="atlas"]')!;
  const select = () => host.querySelector<HTMLSelectElement>('select')!;
  const useAtlas = async () => act(async () => atlasRadio().click());
  const pick = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select(), value);
    select().dispatchEvent(new Event('change', { bubbles: true }));
  });

  it('preselects the raid named like the tier, with the hint', async () => {
    await render(); await useAtlas();
    expect(select().value).toBe('MoltenCore');
    expect([...select().options].map((o) => o.textContent)).toEqual(['Choose a raid', 'Molten Core', 'Onyxia’s Lair']);
    expect(host.textContent).toContain('From the AtlasLoot version this site uses.');
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('previews a table fetched by raid key, with the configured item database as source', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'ok', source: 'CLASSIC', value: { ...loadFile, name: 'AtlasLoot: Molten Core' } });
    client.previewLoadTable.mockResolvedValue(ready());
    await render(); await useAtlas(); await click('Preview');
    expect(client.fetchAtlasTable).toHaveBeenCalledWith('MoltenCore');
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ source: 'CLASSIC', loadFile: expect.objectContaining({ name: 'AtlasLoot: Molten Core' }) }));
    expect(host.textContent).toContain('From AtlasLoot: Molten Core · merge');
    client.applyLoadTable.mockResolvedValue({ kind: 'success', added: 4, newBosses: 1 });
    await click('Load 4 items');
    expect(client.applyLoadTable).toHaveBeenCalledWith(expect.objectContaining({ source: 'CLASSIC', token: 'tok' }));
  });

  it('preselects nothing and disables Preview when no raid matches the tier, until another is chosen', async () => {
    client.loadAtlasRaids.mockResolvedValue({ kind: 'ready', source: 'CLASSIC', raids: [atlasRaids[1]] });
    await render(); await useAtlas();
    expect(select().value).toBe('');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('AtlasLoot’s data on this site has no Molten Core. Choose another raid or load a file.');
    expect(button('Preview')!.disabled).toBe(true);
    await pick('Onyxia');
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('greys AtlasLoot with the live-site reason and leaves File working', async () => {
    client.loadAtlasRaids.mockResolvedValue({ kind: 'off' });
    await render();
    expect(atlasRadio().disabled).toBe(true);
    expect(host.textContent).toContain('AtlasLoot has Classic items only. The live site takes WoW Forever items.');
    await choose();
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('says so inline when the data can’t be downloaded, and keeps File available', async () => {
    client.loadAtlasRaids.mockResolvedValue({ kind: 'error', error: 'Couldn’t download AtlasLoot’s data. Try again, or load a file.' });
    await render(); await useAtlas();
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Couldn’t download AtlasLoot’s data. Try again, or load a file.');
    expect(button('Preview')!.disabled).toBe(true);
    await act(async () => host.querySelector<HTMLInputElement>('input[value="file"]')!.click());
    await choose();
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('shows the server’s sentence when the raid table is refused, and stays on step 1', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'error', error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file.' });
    await render(); await useAtlas(); await click('Preview');
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('no such raid');
    expect(client.previewLoadTable).not.toHaveBeenCalled();
  });

  it('keeps Preview disabled after the server says the raid is missing, until the raid changes', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'error', missing: true, error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file.' });
    await render(); await useAtlas(); await click('Preview');
    expect(button('Preview')!.disabled).toBe(true);
    await pick('Onyxia');
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('keeps Preview available after a download failure, so it can be tried again', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'error', error: 'Couldn’t download AtlasLoot’s data. Try again, or load a file.' });
    await render(); await useAtlas(); await click('Preview');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('drops a table still downloading when the raid or source changes', async () => {
    let finish!: (value: unknown) => void;
    client.fetchAtlasTable.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await render(); await useAtlas(); await click('Preview');
    await pick('Onyxia');
    await act(async () => finish({ kind: 'ok', source: 'CLASSIC', value: loadFile }));
    expect(client.previewLoadTable).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Fetching items');
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('never previews an AtlasLoot table when switched back to File', async () => {
    client.previewLoadTable.mockResolvedValue({ kind: 'error', error: 'x' });
    await render(); await choose(); await useAtlas();
    await act(async () => host.querySelector<HTMLInputElement>('input[value="file"]')!.click());
    await click('Preview');
    expect(client.fetchAtlasTable).not.toHaveBeenCalled();
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ source: 'FOREVER', loadFile }));
  });
});
