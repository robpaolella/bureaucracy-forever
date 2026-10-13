// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastHost } from '@/components/ui';
import { LOOT_LOG } from '@/content/loot-log';
import type { LootTableView } from '@/lib/loot-data';
import { LOOKUP_DELAY_MS } from './UnlistedDrop';
import { LootLog } from './LootLog';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

const view = (id: number, name: string) => ({ id, name, quality: 4, icon: 'inv', tooltipHtml: '' });
const table = (): LootTableView => ({
  bosses: [{ id: 'onyxia', name: 'Onyxia', isTrash: false, itemIds: [1] }, { id: 'trash', name: 'Trash', isTrash: true, itemIds: [2] }],
  items: { 1: view(1, 'Blade'), 2: view(2, 'Collar') }, blocked: [],
});
const candidates = [{ userId: 'u1', name: 'notary', characters: [{ id: 'c1', name: 'Notary', wowClass: 'shaman' as const, isMain: true }] }];
const bracers = view(231044, 'Whelp-Scale Bracers');
const copy = LOOT_LOG.unlisted;

const fetcher = vi.fn();
const answer = (status: number, body: object) => ({ ok: status < 400, status, json: async () => body });
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks(); fetcher.mockReset();
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', fetcher);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const render = async (t = table(), awards: Parameters<typeof LootLog>[0]['awards'] = []) =>
  act(async () => root.render(<ToastHost><LootLog raidId="raid" templateId="tpl" templateName="Onyxia’s Lair" table={t} reserves={[]} candidates={candidates} raidAwards={[]} hrAwards={[]} awards={awards} /></ToastHost>));
const select = (label: string) => [...host.querySelectorAll('select')].find((s) => host.querySelector(`label[for="${s.id}"]`)?.textContent === label)!;
const choose = async (el: HTMLSelectElement, value: string) => act(async () => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); });
const type = async (value: string) => act(async () => {
  const input = host.querySelector<HTMLInputElement>(`input[placeholder="${copy.refPlaceholder}"]`)!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const settle = async () => act(async () => { await vi.advanceTimersByTimeAsync(LOOKUP_DELAY_MS); });
const button = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent === text)!;
const submit = async () => act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
const body = (call: number) => JSON.parse(fetcher.mock.calls[call][1].body);
const postCalls = () => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');

/** Pick "Item not on the table…", look up the bracers and choose the winner. */
async function foundAndWinner() {
  fetcher.mockResolvedValueOnce(answer(200, { item: bracers, onTable: [] }));
  await render();
  await choose(select('Item'), 'unlisted');
  await type('231044'); await settle();
  await choose(select('Winner'), 'c1');
}

describe('LootLog unlisted drop', () => {
  it('ends the Item list with a Not on the list? group and moves focus to the link box', async () => {
    await render();
    const group = select('Item').querySelector('optgroup')!;
    expect(group.label).toBe(copy.group); expect(group.textContent).toBe(copy.option);
    expect(host.textContent).not.toContain(copy.refLabel);
    await choose(select('Item'), 'unlisted');
    expect(host.textContent).toContain(copy.refLabel);
    expect(document.activeElement).toBe(host.querySelector(`input[placeholder="${copy.refPlaceholder}"]`));
  });

  it('shows a new item with the boss it joins, which follows the Boss choice', async () => {
    await foundAndWinner();
    expect(host.textContent).toContain(`${copy.newBefore}Onyxia${copy.newAfter}`);
    expect(button(LOOT_LOG.addAndRecord).disabled).toBe(false);
    await choose(select('Boss'), 'trash');
    expect(host.textContent).toContain(`${copy.newBefore}Trash${copy.newAfter}`);
    expect(host.textContent).toContain('Whelp-Scale Bracers');
  });

  it('keeps Add and record disabled until a winner is picked', async () => {
    fetcher.mockResolvedValueOnce(answer(200, { item: bracers, onTable: [] }));
    await render(); await choose(select('Item'), 'unlisted'); await type('231044'); await settle();
    expect(button(LOOT_LOG.addAndRecord).disabled).toBe(true);
  });

  it('switches the Item list to an item already on the table, and Boss when needed, then records it as usual', async () => {
    fetcher.mockResolvedValueOnce(answer(200, { item: view(2, 'Collar'), onTable: [{ bossId: 'trash', bossName: 'Trash' }] }));
    await render();
    await choose(select('Item'), 'unlisted'); await type('2'); await settle();
    expect(select('Boss').value).toBe('trash'); expect(select('Item').value).toBe('2');
    expect(host.textContent).toContain(copy.onTable('Collar', 'Trash'));
    expect(host.querySelector(`input[placeholder="${copy.refPlaceholder}"]`)).toBeNull();
    expect(button(LOOT_LOG.record)).toBeTruthy(); expect(host.textContent).not.toContain(LOOT_LOG.addAndRecord);
    await choose(select('Winner'), 'c1');
    fetcher.mockResolvedValueOnce(answer(201, { id: 'a1', addedToTable: false }));
    await submit();
    expect(body(1)).toMatchObject({ itemId: 2, bossId: 'trash' }); expect(body(1).itemRef).toBeUndefined();
    expect(host.textContent).toContain(LOOT_LOG.recorded('Collar', 'notary (Notary)'));
  });

  it('keeps the selected Boss when the item is on it', async () => {
    fetcher.mockResolvedValueOnce(answer(200, { item: view(1, 'Blade'), onTable: [{ bossId: 'trash', bossName: 'Trash' }, { bossId: 'onyxia', bossName: 'Onyxia' }] }));
    await render(); await choose(select('Item'), 'unlisted'); await type('1'); await settle();
    expect(select('Boss').value).toBe('onyxia'); expect(select('Item').value).toBe('1');
    expect(host.textContent).toContain(copy.onTable('Blade', 'Trash, Onyxia'));
  });

  it('adds and records: sends the link, boss and a request key, then resets and shows the new wording', async () => {
    await foundAndWinner();
    fetcher.mockResolvedValueOnce(answer(201, { id: 'a1', addedToTable: true }));
    await submit();
    expect(fetcher.mock.calls[1][0]).toBe('/api/raids/raid/loot');
    expect(body(1)).toMatchObject({ itemRef: '231044', bossId: 'onyxia', characterId: 'c1', method: 'OPEN_ROLL' });
    expect(body(1).itemId).toBeUndefined(); expect(body(1).requestKey).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    expect(host.textContent).toContain(LOOT_LOG.addedRecorded('Whelp-Scale Bracers', 'Onyxia', 'notary (Notary)'));
    expect(select('Item').value).toBe(''); expect(host.textContent).not.toContain(copy.refLabel);
    expect(refresh).toHaveBeenCalled();
  });

  it('says Nothing was saved on a failed save, keeps the form and reuses the request key; replayed counts as success', async () => {
    await foundAndWinner();
    fetcher.mockResolvedValueOnce(answer(500, { error: 'Server wording' })).mockResolvedValueOnce(answer(200, { id: 'a1', replayed: true }));
    await submit();
    expect(host.textContent).toContain(LOOT_LOG.notSaved); expect(host.textContent).toContain(LOOT_LOG.notSavedDetail);
    expect(host.textContent).not.toContain('Server wording');
    expect(select('Item').value).toBe('unlisted'); expect(select('Winner').value).toBe('c1'); expect(button(LOOT_LOG.addAndRecord).disabled).toBe(false);
    await submit();
    expect(postCalls()).toHaveLength(2);
    expect(body(2).requestKey).toBe(body(1).requestKey);
    expect(select('Item').value).toBe('');
    expect(host.textContent).toContain(LOOT_LOG.addedRecorded('Whelp-Scale Bracers', 'Onyxia', 'notary (Notary)'));
  });

  it('treats a request that never answers as a failed save', async () => {
    await foundAndWinner();
    fetcher.mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
    await submit();
    expect(host.textContent).toContain(LOOT_LOG.notSaved); expect(select('Item').value).toBe('unlisted');
  });

  it('uses a new request key after a save, and when the link changes', async () => {
    await foundAndWinner();
    fetcher.mockResolvedValueOnce(answer(201, { id: 'a1', addedToTable: true }));
    await submit();
    const first = body(1).requestKey;
    fetcher.mockResolvedValueOnce(answer(200, { item: bracers, onTable: [] }));
    await choose(select('Item'), 'unlisted'); await type('231044'); await settle(); await choose(select('Winner'), 'c1');
    fetcher.mockResolvedValueOnce(answer(500, {})).mockResolvedValueOnce(answer(200, { item: view(555, 'Other'), onTable: [] })).mockResolvedValueOnce(answer(500, {}));
    await submit();
    const second = body(3).requestKey;
    expect(second).not.toBe(first);
    await type('555'); await settle(); await choose(select('Winner'), 'c1'); await submit();
    expect(body(5).requestKey).not.toBe(second);
  });

  it('records a disenchant or bank with its own toast', async () => {
    fetcher.mockResolvedValueOnce(answer(200, { item: bracers, onTable: [] }));
    await render(); await choose(select('Item'), 'unlisted'); await type('231044'); await settle();
    fetcher.mockResolvedValueOnce(answer(201, { id: 'a1', addedToTable: true }));
    await act(async () => { button(LOOT_LOG.disenchant).click(); });
    expect(body(1)).toMatchObject({ itemRef: '231044', characterId: null, method: 'DISENCHANT_BANK' });
    expect(host.textContent).toContain(LOOT_LOG.addedBanked('Whelp-Scale Bracers', 'Onyxia'));
  });

  it('keeps the normal record path as it was', async () => {
    await render(); await choose(select('Item'), '1'); await choose(select('Winner'), 'c1');
    fetcher.mockResolvedValueOnce(answer(201, { id: 'a1' }));
    await submit();
    expect(body(0)).toMatchObject({ itemId: 1, bossId: 'onyxia' }); expect(body(0).requestKey).toBeUndefined();
    expect(host.textContent).toContain(LOOT_LOG.recorded('Blade', 'notary (Notary)'));
  });

  it('shows the no-bosses message with a link to the tier’s table, and an empty Recorded list', async () => {
    await render({ bosses: [], items: {}, blocked: [] });
    expect(host.textContent).toContain(copy.noBosses);
    expect(host.querySelector('a')!.getAttribute('href')).toBe('/officers/loot/tpl');
    expect(host.querySelector('a')!.textContent).toBe(copy.tableLink('Onyxia’s Lair'));
    expect(host.textContent).toContain(LOOT_LOG.listEmpty);
    expect(host.querySelector('select')).toBeNull();
  });
});
