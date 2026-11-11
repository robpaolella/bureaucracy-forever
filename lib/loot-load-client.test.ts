import { describe, expect, it, vi } from 'vitest';
import { parseIdsFile } from './loot-import';
import { applyLoadTable, fetchAtlasTable, fetchForeverTable, loadForeverDungeons, LOAD_TABLE_MESSAGES, loadAtlasRaids, previewLoadTable, readLoadFile, toIdsFile, type LoadFile } from './loot-load-client';

const loadFile: LoadFile = { name: 'molten-core.json', file: { bosses: [{ name: 'Lucifron', isTrash: false, itemIds: [1, 2, 3] }], skipped: [] }, total: 3 };
const preview = { token: 'a'.repeat(64), bosses: [], added: 2, newBosses: 0, removed: 0, removedBosses: 0, kept: 0 };
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

describe('previewLoadTable boss names', () => {
  const run = (checkNames: boolean | undefined, bossCheck: unknown) => {
    const fetcher = vi.fn().mockResolvedValue(response({ remaining: 0, skip: [], failed: [], preview, bossCheck }));
    return previewLoadTable({ templateId: 'mc', loadFile, fetcher, checkNames }).then((result) => ({ result, body: JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string) }));
  };
  const check = { kind: 'checked', flagged: ['Magmatus'], unmatched: ['Infurnus'] };
  it('asks for the check only when told to, and returns what the server says', async () => {
    const asked = await run(true, check);
    expect(asked.body.checkNames).toBe(true);
    expect(asked.result).toMatchObject({ kind: 'preview', bossCheck: check });
    const notAsked = await run(undefined, check);
    expect(notAsked.body).not.toHaveProperty('checkNames');
    expect(notAsked.result).toMatchObject({ bossCheck: null });
  });
  it('ignores an answer it cannot read', async () => {
    expect((await run(true, { kind: 'checked', flagged: 'x' })).result).toMatchObject({ bossCheck: null });
    expect((await run(true, { kind: 'unchecked', reason: 'no-instance' })).result).toMatchObject({ bossCheck: { kind: 'unchecked' } });
  });
});

describe('previewLoadTable', () => {
  it('continues with returned skip, reports each batch, and retains all failures', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ remaining: 1, skip: [2], failed: [{ id: 2, error: 'Not found' }], preview: null }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [2, 3], failed: [{ id: 3, error: 'Gone' }], preview }));
    const progress = vi.fn();

    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher, onProgress: progress })).resolves.toEqual({ kind: 'preview', preview, items: [], failed: [{ id: 2, error: 'Not found' }, { id: 3, error: 'Gone' }], nothingToChange: false, bossCheck: null });
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string))).toEqual([
      { file: sent, source: 'FOREVER', skip: [], replace: false }, { file: sent, source: 'FOREVER', skip: [2], replace: false },
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

  it('marks a completed preview as unchanged only when it adds and removes nothing', async () => {
    const none = { ...preview, added: 0, newBosses: 0, kept: 2 };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview: none }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview: { ...none, newBosses: 1 } }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview: { ...none, removed: 1 } }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview: { ...none, removedBosses: 1 } }));
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher })).resolves.toMatchObject({ kind: 'preview', nothingToChange: true });
    for (let i = 0; i < 3; i++) await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher })).resolves.toMatchObject({ kind: 'preview', nothingToChange: false });
  });

  it('sends the replace choice with every batch', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ remaining: 1, skip: [], failed: [], preview: null }))
      .mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview }));
    await previewLoadTable({ templateId: 'mc', loadFile, fetcher, replace: true });
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).replace)).toEqual([true, true]);
    await previewLoadTable({ templateId: 'mc', loadFile, fetcher: fetcher.mockResolvedValueOnce(response({ remaining: 0, skip: [], failed: [], preview })) });
    expect(JSON.parse((fetcher.mock.calls[2][1] as RequestInit).body as string).replace).toBe(false);
  });

  it('uses route sentences and the network message for preview failures', async () => {
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher: vi.fn().mockResolvedValue(response({ error: 'No such raid tier.' }, 404)) })).resolves.toEqual({ kind: 'error', error: 'No such raid tier.' });
    await expect(previewLoadTable({ templateId: 'mc', loadFile, fetcher: vi.fn().mockRejectedValue(new Error('offline')) })).resolves.toEqual({ kind: 'error', error: LOAD_TABLE_MESSAGES.UNREACHABLE });
  });
});

describe('applyLoadTable', () => {
  it('sends the source filename and returns success', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ added: 2, newBosses: 1, removed: 3 }));
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher, replace: true })).resolves.toEqual({ kind: 'success', added: 2, newBosses: 1, removed: 3 });
    expect(JSON.parse((fetcher.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ sourceName: 'molten-core.json', token: preview.token, file: sent, replace: true });
  });

  it('maps stale, plain route, and save failures', async () => {
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: 'The table changed since this preview.' }, 409)) })).resolves.toEqual({ kind: 'stale', error: 'The table changed since this preview.', hint: 'Preview again to see the current changes.' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: 'Preview this file before loading it.' }, 400)) })).resolves.toEqual({ kind: 'error', error: 'Preview this file before loading it.' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: 'Item ids 2: already cached for Classic.' }, 409)) })).resolves.toEqual({ kind: 'error', error: 'Item ids 2: already cached for Classic.' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(response({ error: "Couldn't save that." }, 500)) })).resolves.toEqual({ kind: 'save-failed' });
    await expect(applyLoadTable({ templateId: 'mc', loadFile, token: preview.token, fetcher: vi.fn().mockResolvedValue(new Response('not json')) })).resolves.toEqual({ kind: 'save-failed' });
  });
});

describe('AtlasLoot', () => {
  it('lists raids, or says AtlasLoot is off, or surfaces the server’s sentence', async () => {
    const raids = [{ key: 'Onyxia', name: 'Onyxia’s Lair' }];
    await expect(loadAtlasRaids(vi.fn().mockResolvedValue(response({ source: 'CLASSIC', off: false, raids })))).resolves.toEqual({ kind: 'ready', raids, source: 'CLASSIC' });
    await expect(loadAtlasRaids(vi.fn().mockResolvedValue(response({ source: 'CLASSIC', off: true, raids: [] })))).resolves.toEqual({ kind: 'off' });
    await expect(loadAtlasRaids(vi.fn().mockResolvedValue(response({ error: 'Couldn’t download.' }, 502)))).resolves.toEqual({ kind: 'error', error: 'Couldn’t download.' });
    await expect(loadAtlasRaids(vi.fn().mockRejectedValue(new Error('offline')))).resolves.toEqual({ kind: 'error', error: LOAD_TABLE_MESSAGES.UNREACHABLE });
  });

  it('posts a raid key only and returns the table as a load file named for the raid', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ source: 'CLASSIC', name: 'AtlasLoot: Molten Core', file: sent }));
    const result = await fetchAtlasTable('MoltenCore', fetcher);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ raidKey: 'MoltenCore' });
    expect(result).toEqual({ kind: 'ok', source: 'CLASSIC', value: { ...loadFile, name: 'AtlasLoot: Molten Core' } });
  });

  it('returns the server’s sentence for a refused raid, and a plain one for a bad answer', async () => {
    await expect(fetchAtlasTable('Nope', vi.fn().mockResolvedValue(response({ error: 'No such raid.' }, 404)))).resolves.toEqual({ kind: 'error', error: 'No such raid.', missing: true });
    await expect(fetchAtlasTable('Nope', vi.fn().mockResolvedValue(response({ error: 'Couldn’t download.' }, 502)))).resolves.toEqual({ kind: 'error', error: 'Couldn’t download.' });
    await expect(fetchAtlasTable('X', vi.fn().mockResolvedValue(response({ source: 'CLASSIC', name: 'x', file: {} })))).resolves.toEqual({ kind: 'error', error: LOAD_TABLE_MESSAGES.UNREACHABLE });
  });
});

describe('foreverchanges.pro', () => {
  it('lists dungeons as keys and names, and surfaces the server’s sentence', async () => {
    const dungeons = [{ slug: 'the-deadmines', name: 'The Deadmines' }, { slug: 5, name: 'bad' }];
    await expect(loadForeverDungeons(vi.fn().mockResolvedValue(response({ dungeons })))).resolves.toEqual({ kind: 'ready', source: 'FOREVER', raids: [{ key: 'the-deadmines', name: 'The Deadmines' }] });
    await expect(loadForeverDungeons(vi.fn().mockResolvedValue(response({ error: 'Try again later, or load a file manually.' }, 502)))).resolves.toEqual({ kind: 'error', error: 'Try again later, or load a file manually.' });
    await expect(loadForeverDungeons(vi.fn().mockResolvedValue(response({})))).resolves.toEqual({ kind: 'error', error: LOAD_TABLE_MESSAGES.UNREACHABLE });
    await expect(loadForeverDungeons(vi.fn().mockRejectedValue(new Error('offline')))).resolves.toEqual({ kind: 'error', error: LOAD_TABLE_MESSAGES.UNREACHABLE });
  });

  it('posts a slug only, and the table keeps the name the history will show', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ source: 'FOREVER', name: 'foreverchanges.pro: The Deadmines', file: sent }));
    const result = await fetchForeverTable('the-deadmines', fetcher);
    expect(fetcher.mock.calls[0][0]).toBe('/api/loot/foreverchanges');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ slug: 'the-deadmines' });
    expect(result).toEqual({ kind: 'ok', source: 'FOREVER', value: { ...loadFile, name: 'foreverchanges.pro: The Deadmines' } });
    const apply = vi.fn().mockResolvedValue(response({ added: 1, newBosses: 0, removed: 0 }));
    await applyLoadTable({ templateId: 'mc', loadFile: result.kind === 'ok' ? result.value : loadFile, token: 't', source: 'FOREVER', fetcher: apply });
    expect(JSON.parse(apply.mock.calls[0][1].body).sourceName).toBe('foreverchanges.pro: The Deadmines');
  });

  it('returns the route’s plain error and nothing else', async () => {
    await expect(fetchForeverTable('x', vi.fn().mockResolvedValue(response({ error: 'Couldn’t reach foreverchanges.pro. Try again later, or load a file manually.' }, 502)))).resolves.toEqual({ kind: 'error', error: 'Couldn’t reach foreverchanges.pro. Try again later, or load a file manually.' });
  });
});
