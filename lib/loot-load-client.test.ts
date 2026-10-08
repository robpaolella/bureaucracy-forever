import { describe, expect, it, vi } from 'vitest';
import { parseIdsFile } from './loot-import';
import { applyLoadTable, LOAD_TABLE_MESSAGES, previewLoadTable, readLoadFile, toIdsFile, type LoadFile } from './loot-load-client';

const loadFile: LoadFile = { name: 'molten-core.json', file: { bosses: [{ name: 'Lucifron', isTrash: false, itemIds: [1, 2, 3] }], skipped: [] }, total: 3 };
const preview = { token: 'a'.repeat(64), bosses: [], added: 2, newBosses: 0 };
const sent = { bosses: [{ name: 'Lucifron', trash: false, items: [1, 2, 3] }] };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('readLoadFile', () => {
  it('returns parser reasons with the design prefix, including invalid JSON', async () => {
    await expect(readLoadFile({ name: 'bad.json', text: async () => '{' } as File)).resolves.toEqual({ ok: false, error: 'This file isn’t a loot list: it isn’t valid JSON.' });
    await expect(readLoadFile({ name: 'bad.json', text: async () => JSON.stringify({ bosses: [{ name: 'Ragnaros' }] }) } as File)).resolves.toEqual({ ok: false, error: 'This file isn’t a loot list: “Ragnaros” needs “items”: a list of item ids.' });
  });

  it('returns a read failure with the same prefix', async () => {
    await expect(readLoadFile({ name: 'bad.json', text: async () => { throw new Error('nope'); } } as unknown as File)).resolves.toEqual({ ok: false, error: 'This file isn’t a loot list: couldn’t read this file.' });
  });
});

describe('toIdsFile', () => {
  it('sends the importer format, which the routes parse back to the same table', () => {
    const table = { skipped: [], bosses: [{ name: 'Lucifron', isTrash: false, itemIds: [1, 2] }, { name: 'Trash', isTrash: true, itemIds: [3] }] };
    expect(parseIdsFile(toIdsFile(table))).toEqual(table);
  });
});

describe('previewLoadTable', () => {
  it('continues with returned skip, reports each batch, and retains all failures', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ remaining: 1, skip: [2], failed: [{ id: 2, error: 'Not found' }], preview: null }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [2, 3], failed: [{ id: 3, error: 'Gone' }], preview }));
    const progress = vi.fn();

    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher, onProgress: progress })).resolves.toEqual({ kind: 'preview', preview, items: [], failed: [{ id: 2, error: 'Not found' }, { id: 3, error: 'Gone' }], nothingToChange: false });
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))).toEqual([
      { file: sent, source: 'FOREVER', skip: [] }, { file: sent, source: 'FOREVER', skip: [2] },
    ]);
    expect(progress).toHaveBeenCalledWith({ completed: 2, total: 3 });
    expect(progress).toHaveBeenLastCalledWith({ completed: 3, total: 3 });
  });

  it('stops after its in-flight request and never applies', async () => {
    let stop = false;
    const fetcher = vi.fn().mockImplementation(async () => { stop = true; return response({ remaining: 1, skip: [], failed: [], preview: null }); });
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher, stopped: () => stop })).resolves.toEqual({ kind: 'stopped' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('starts with an empty skip list again to retry missing ids', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ remaining: 0, skip: [2], failed: [{ id: 2, error: 'Not found' }], preview }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview }));
    await previewLoadTable({ templateId: 'mc', loadFile, fetcher });
    await previewLoadTable({ templateId: 'mc', loadFile, fetcher });
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).skip)).toEqual([[], []]);
  });

  it('keeps well-formed preview items and drops malformed ones', async () => {
    const item = { id: 1, name: 'Ashen Signet', quality: 4, icon: 'inv_jewelry_ring_01' };
    const fetcher = vi.fn().mockResolvedValue(response({ remaining: 0, skip: [], failed: [], preview, items: [item, { id: 2, name: 7 }, null] }));
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher })).resolves.toMatchObject({ kind: 'preview', items: [item] });
  });

  it('marks a completed preview as unchanged only when it has no additions or new bosses', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview: { ...preview, added: 0, newBosses: 0 } }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview: { ...preview, added: 0, newBosses: 1 } }));
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher })).resolves.toMatchObject({ kind: 'preview', nothingToChange: true });
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher })).resolves.toMatchObject({ kind: 'preview', nothingToChange: false });
  });

  it('uses route sentences and the network message for preview failures', async () => {
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher: vi.fn().mockResolvedValue(response({ error: 'No such raid tier.' }, 404)) })).resolves.toEqual({ kind: 'error', error: 'No such raid tier.' });
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher: vi.fn().mockRejectedValue(new Error('offline')) })).resolves.toEqual({ kind: 'error', error: LOAD_TABLE_MESSAGES.UNREACHABLE });
  });
});

describe('applyLoadTable', () => {
  it('sends the source filename and returns success', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ added: 2, newBosses: 1 }));
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher })).resolves.toEqual({ kind: 'success', added: 2, newBosses: 1 });
    expect(JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ sourceName: 'molten-core.json', token: preview.token, file: sent });
  });

  it('maps stale, plain route, and save failures', async () => {
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: 'The table changed since this preview.' }, 409)) })).resolves.toEqual({ kind: 'stale', error: 'The table changed since this preview.', hint: 'Preview again to see the current changes.' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: 'Preview this file before loading it.' }, 400)) })).resolves.toEqual({ kind: 'error', error: 'Preview this file before loading it.' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: 'Item ids 2: already cached for Classic.' }, 409)) })).resolves.toEqual({ kind: 'error', error: 'Item ids 2: already cached for Classic.' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: "Couldn't save that." }, 500)) })).resolves.toEqual({ kind: 'save-failed' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(new Response('not json')) })).resolves.toEqual({ kind: 'save-failed' });
  });
});
