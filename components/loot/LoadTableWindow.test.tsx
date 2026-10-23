// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import type { ApplyResult, LoadFile, PreviewResult } from '@/lib/loot-load-client';
import { LoadTableWindow } from './LoadTableWindow';

const client = vi.hoisted(() => ({ readLoadFile: vi.fn(), previewLoadTable: vi.fn(), applyLoadTable: vi.fn(), loadAtlasRaids: vi.fn(), fetchAtlasTable: vi.fn(), loadForeverDungeons: vi.fn(), fetchForeverTable: vi.fn() }));
vi.mock('@/lib/loot-load-client', async (real) => ({ ...(await real<object>()), ...client }));

const loadFile: LoadFile = {
  name: 'molten-core.json', total: 6,
  file: { bosses: [{ name: 'Lucifron', isTrash: false, itemIds: [1, 2, 3] }, { name: 'Trash', isTrash: true, itemIds: [4, 5, 6] }], skipped: [] },
};
const merge = { remove: [], kept: [], absent: null };
const ready = (failed: number[] = [6], added = 4): PreviewResult => ({
  kind: 'preview', bossCheck: null, nothingToChange: added === 0, failed: failed.map((id) => ({ id, error: 'Not found' })),
  items: [{ id: 2, name: 'Ashen Signet', quality: 4, icon: 'inv_ring' }],
  preview: { token: 'tok', added, newBosses: 1, removed: 0, removedBosses: 0, kept: 0, bosses: [
    { bossId: 'b1', name: 'Lucifron', isTrash: false, isNew: false, add: [2, 3], already: [1], notFound: [], ...merge },
    { bossId: 'b9', name: 'Test boss', isTrash: false, isNew: false, add: [], already: [], notFound: [], ...merge },
    { bossId: null, name: 'Trash', isTrash: true, isNew: true, add: [4, 5], already: [], notFound: failed, ...merge },
  ] },
});

const dungeons = [{ key: 'the-deadmines', name: 'The Deadmines' }, { key: 'molten-core', name: 'Molten Core' }];
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
  client.loadForeverDungeons.mockResolvedValue({ kind: 'ready', source: 'FOREVER', raids: dungeons });
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
    await toPreview(); applying({ kind: 'success', added: 4, newBosses: 1, removed: 0 });
    await click('Load 4 items');
    expect(client.applyLoadTable).toHaveBeenCalledWith({ templateId: 'mc', loadFile, token: 'tok', source: 'FOREVER', replace: false });
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
    await act(async () => finish({ kind: 'success', added: 4, newBosses: 1, removed: 0 }));
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
    await toPreview(); applying({ kind: 'save-failed' }, { kind: 'success', added: 4, newBosses: 1, removed: 0 });
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

describe('LoadTableWindow WoW Forever', () => {
  const select = () => host.querySelector<HTMLSelectElement>('select')!;
  const useForever = async () => act(async () => host.querySelector<HTMLInputElement>('input[value="forever"]')!.click());

  it('asks for the dungeons only once chosen, preselects the template’s match and says where they come from', async () => {
    await render();
    expect(client.loadForeverDungeons).not.toHaveBeenCalled();
    await useForever();
    expect(select().value).toBe('molten-core');
    expect([...select().options].map((o) => o.textContent)).toEqual(['Choose a dungeon', 'The Deadmines', 'Molten Core']);
    expect(host.textContent).toContain('foreverchanges.pro, a fan site for WoW Forever');
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('previews the chosen dungeon with Wowhead Forever items, then applies; history gets the dungeon’s name', async () => {
    client.fetchForeverTable.mockResolvedValue({ kind: 'ok', source: 'FOREVER', value: { ...loadFile, name: 'foreverchanges.pro: Molten Core' } });
    client.previewLoadTable.mockResolvedValue(ready());
    await render(); await useForever(); await click('Preview');
    expect(client.fetchForeverTable).toHaveBeenCalledWith('molten-core');
    expect(client.fetchAtlasTable).not.toHaveBeenCalled();
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ source: 'FOREVER' }));
    expect(host.textContent).toContain('From foreverchanges.pro: Molten Core · merge');
    client.applyLoadTable.mockResolvedValue({ kind: 'success', added: 4, newBosses: 1, removed: 0 });
    await click('Load 4 items');
    expect(client.applyLoadTable).toHaveBeenCalledWith(expect.objectContaining({ source: 'FOREVER', token: 'tok', loadFile: expect.objectContaining({ name: 'foreverchanges.pro: Molten Core' }) }));
  });

  it('shows boss-name warnings and the can’t-check note in the preview, and Load still works', async () => {
    client.fetchForeverTable.mockResolvedValue({ kind: 'ok', source: 'FOREVER', value: loadFile });
    const base = ready() as Extract<PreviewResult, { kind: 'preview' }>;
    client.previewLoadTable.mockResolvedValue({ ...base, bossCheck: { kind: 'checked', flagged: ['Magmatus'], unmatched: ['Infurnus'] } });
    await render(); await useForever(); await click('Preview');
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ checkNames: true }));
    expect(host.textContent).toContain('Magmatus not a boss name in the game’s data. It may be a rare monster, or named differently in game');
    expect(host.textContent).toContain('Infurnus');
    client.applyLoadTable.mockResolvedValue({ kind: 'success', added: 4, newBosses: 1, removed: 0 });
    await click('Load 4 items');
    expect(client.applyLoadTable).toHaveBeenCalled();
  });

  it('says names can’t be checked when the template has no instance number, and flags nothing', async () => {
    client.fetchForeverTable.mockResolvedValue({ kind: 'ok', source: 'FOREVER', value: loadFile });
    client.previewLoadTable.mockResolvedValue({ ...(ready() as object), bossCheck: { kind: 'unchecked', reason: 'no-instance' } });
    await render(); await useForever(); await click('Preview');
    expect(host.textContent).toContain('Boss names can’t be checked until this raid has its in-game instance number.');
    expect(host.textContent).not.toContain('not a boss name');
  });

  it('shows no boss-name check for a file or AtlasLoot load', async () => {
    client.previewLoadTable.mockResolvedValue(ready());
    await render();
    expect(host.textContent).not.toContain('Boss names can’t be checked');
  });

  it('shows a failed dungeon list in plain words and applies nothing', async () => {
    client.loadForeverDungeons.mockResolvedValue({ kind: 'error', error: 'Couldn’t reach foreverchanges.pro, or it was too slow. Try again later, or load a file manually.' });
    await render(); await useForever();
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Try again later, or load a file manually.');
    expect(button('Preview')!.disabled).toBe(true);
    expect(client.applyLoadTable).not.toHaveBeenCalled();
  });

  it('asks again when chosen again after a failure', async () => {
    client.loadForeverDungeons.mockResolvedValueOnce({ kind: 'error', error: 'Try again later, or load a file manually.' });
    await render(); await useForever();
    await act(async () => host.querySelector<HTMLInputElement>('input[value="file"]')!.click());
    await useForever();
    expect(client.loadForeverDungeons).toHaveBeenCalledTimes(2);
    expect(select().value).toBe('molten-core');
  });

  it('shows a failed dungeon table in plain words, stays on step 1 and applies nothing', async () => {
    client.fetchForeverTable.mockResolvedValue({ kind: 'error', error: 'Molten Core on foreverchanges.pro couldn’t be read. Try again later, or load a file manually.' });
    await render(); await useForever(); await click('Preview');
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('Try again later, or load a file manually.');
    expect(client.previewLoadTable).not.toHaveBeenCalled();
    expect(client.applyLoadTable).not.toHaveBeenCalled();
  });

  it('says so when no dungeon matches the template, until one is chosen', async () => {
    client.loadForeverDungeons.mockResolvedValue({ kind: 'ready', source: 'FOREVER', raids: [dungeons[0]] });
    await render(); await useForever();
    expect(select().value).toBe('');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('foreverchanges.pro has no Molten Core. Choose another dungeon or load a file manually.');
    expect(button('Preview')!.disabled).toBe(true);
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
    client.applyLoadTable.mockResolvedValue({ kind: 'success', added: 4, newBosses: 1, removed: 0 });
    await click('Load 4 items');
    expect(client.applyLoadTable).toHaveBeenCalledWith(expect.objectContaining({ source: 'CLASSIC', token: 'tok' }));
  });

  it('preselects nothing and disables Preview when no raid matches the tier, until another is chosen', async () => {
    client.loadAtlasRaids.mockResolvedValue({ kind: 'ready', source: 'CLASSIC', raids: [atlasRaids[1]] });
    await render(); await useAtlas();
    expect(select().value).toBe('');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('AtlasLoot’s data on this site has no Molten Core. Choose another raid or load a file manually.');
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
    client.loadAtlasRaids.mockResolvedValue({ kind: 'error', error: 'Couldn’t download AtlasLoot’s data. Try again, or load a file manually.' });
    await render(); await useAtlas();
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Couldn’t download AtlasLoot’s data. Try again, or load a file manually.');
    expect(button('Preview')!.disabled).toBe(true);
    await act(async () => host.querySelector<HTMLInputElement>('input[value="file"]')!.click());
    await choose();
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('shows the server’s sentence when the raid table is refused, and stays on step 1', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'error', error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file manually.' });
    await render(); await useAtlas(); await click('Preview');
    expect(host.querySelector('[role="alert"]')!.textContent).toContain('no such raid');
    expect(client.previewLoadTable).not.toHaveBeenCalled();
  });

  it('keeps Preview disabled after the server says the raid is missing, until the raid changes', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'error', missing: true, error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file manually.' });
    await render(); await useAtlas(); await click('Preview');
    expect(button('Preview')!.disabled).toBe(true);
    await pick('Onyxia');
    expect(button('Preview')!.disabled).toBe(false);
  });

  it('keeps Preview available after a download failure, so it can be tried again', async () => {
    client.fetchAtlasTable.mockResolvedValue({ kind: 'error', error: 'Couldn’t download AtlasLoot’s data. Try again, or load a file manually.' });
    await render(); await useAtlas(); await click('Preview');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(button('Preview')!.disabled).toBe(false);
  });

  it.each([
    ['a download failure', { kind: 'error', error: 'Couldn’t download AtlasLoot’s data. Try again, or load a file manually.' }],
    ['a missing raid', { kind: 'error', missing: true, error: 'AtlasLoot’s data on this site has no such raid. Choose another raid or load a file manually.' }],
  ] as const)('shows %s when Preview again after a stale refusal', async (_name, failure) => {
    client.fetchAtlasTable.mockResolvedValueOnce({ kind: 'ok', source: 'CLASSIC', value: { ...loadFile, name: 'AtlasLoot: Molten Core' } });
    client.previewLoadTable.mockResolvedValueOnce(ready());
    await render(); await useAtlas(); await click('Preview');
    client.applyLoadTable.mockResolvedValueOnce({ kind: 'stale', error: 'The table changed since this preview.', hint: 'Preview again to see the current changes.' });
    await click('Load 4 items');
    expect(button('Preview again')).toBeDefined();
    client.fetchAtlasTable.mockResolvedValueOnce(failure);
    await click('Preview again');
    expect(host.querySelector('[role="alert"]')!.textContent).toBe(failure.error);
    expect(button('Preview again')).toBeUndefined();
    expect(button('Preview')).toBeDefined();
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

describe('LoadTableWindow replace', () => {
  const checkbox = () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  const replaceReady = (): PreviewResult => {
    const base = ready([]) as Extract<PreviewResult, { kind: 'preview' }>;
    const item = (id: number, name: string) => ({ id, name, quality: 4, icon: 'inv_misc' });
    return {
      ...base,
      items: [...base.items, item(10, 'Gone Blade'), item(11, 'Awarded Ring'), item(12, 'Reserved Cloak'), item(13, 'Both Helm')],
      preview: { ...base.preview, removed: 1, removedBosses: 1, kept: 3, bosses: [
        ...base.preview.bosses,
        { bossId: 'b5', name: 'Old Boss', isTrash: false, isNew: false, add: [], already: [], notFound: [], remove: [10], kept: [], absent: 'remove' },
        { bossId: 'b6', name: 'Kept Boss', isTrash: false, isNew: false, add: [], already: [], notFound: [], remove: [], kept: [{ id: 11, has: 'awards' }, { id: 12, has: 'reserves' }, { id: 13, has: 'awards' }], absent: 'keep' },
      ] },
    };
  };
  const replacePreview = async () => {
    client.previewLoadTable.mockResolvedValueOnce(replaceReady());
    await render(); await choose();
    await act(async () => checkbox().click());
    await click('Preview');
  };

  it('offers Replace off by default, with its hint, for File and AtlasLoot', async () => {
    await render();
    expect(checkbox().checked).toBe(false);
    expect(host.textContent).toContain('Replace: remove bosses and items the source doesn’t have');
    expect(host.textContent).toContain('Items with reserves or awards are always kept, with their boss.');
    await act(async () => host.querySelector<HTMLInputElement>('input[value="atlas"]')!.click());
    expect(checkbox()).toBeTruthy();
    expect(checkbox().checked).toBe(false);
  });

  it('sends merge unless Replace is on', async () => {
    await toPreview();
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ replace: false }));
  });

  it('shows the Removes list above Adds, with the summary, tags and the red confirm', async () => {
    await replacePreview();
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
    const text = host.textContent!;
    expect(text).toContain('Removes 1 item and 1 boss. Keeps 3 items with reserves or awards.');
    expect([...host.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Removes', 'Adds']);
    expect(text).toContain('Old BossBoss removed1 removed');
    expect(text).toContain('Kept BossBoss kept: has reserves or awards0 removed · 3 kept');
    expect(text).toContain('From molten-core.json · replace');
    const rows = [...host.querySelectorAll('li')];
    const row = (name: string) => rows.find((r) => r.textContent!.includes(name))!;
    expect(row('Gone Blade').querySelector('.line-through')).not.toBeNull();
    expect(row('Awarded Ring').textContent).toContain('Kept: has awards');
    expect(row('Reserved Cloak').textContent).toContain('Kept: has reserves');
    // Reserves and awards on one item show one tag, the stronger reason.
    expect(row('Both Helm').textContent).toContain('Kept: has awards');
    expect(row('Both Helm').textContent).not.toContain('reserves');
    expect(row('Awarded Ring').querySelector('.line-through')).toBeNull();
    const confirm = button('Load and remove 1 item')!;
    expect(confirm.className).toContain('text-stop');
    expect(button('Load 4 items')).toBeUndefined();
  });

  it('applies with replace and reports removed items', async () => {
    await replacePreview();
    client.applyLoadTable.mockResolvedValueOnce({ kind: 'success', added: 101, newBosses: 1, removed: 5 });
    await click('Load and remove 1 item');
    expect(client.applyLoadTable).toHaveBeenCalledWith({ templateId: 'mc', loadFile, token: 'tok', source: 'FOREVER', replace: true });
    expect(toasts()).toContain('Loaded molten-core.json: added 101 items, removed 5.');
  });

  it('treats a replace that removes nothing like a merge', async () => {
    client.previewLoadTable.mockResolvedValueOnce(ready());
    await render(); await choose();
    await act(async () => checkbox().click());
    await click('Preview');
    expect(host.textContent).toContain('Nothing is removed.');
    expect(host.textContent).not.toContain('Removes');
    expect(button('Load 4 items')).toBeDefined();
    expect(host.textContent).toContain('From molten-core.json · replace');
  });

  it('locks Replace while an AtlasLoot table downloads, so the preview matches what was asked', async () => {
    let finish!: (r: unknown) => void;
    client.fetchAtlasTable.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    await render();
    await act(async () => host.querySelector<HTMLInputElement>('input[value="atlas"]')!.click());
    await act(async () => checkbox().click());
    await click('Preview');
    expect(checkbox().disabled).toBe(true);
    client.previewLoadTable.mockResolvedValueOnce(ready());
    await act(async () => finish({ kind: 'ok', source: 'CLASSIC', value: loadFile }));
    expect(client.previewLoadTable).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
  });
});
