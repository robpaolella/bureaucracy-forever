import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { role: 'officer', discordId: 'd9' } as { role: string; discordId: string } | null,
  loot: true,
  raid: vi.fn(),
  items: vi.fn(),
  boss: vi.fn(),
  character: vi.fn(),
  create: vi.fn(),
  findAward: vi.fn(),
  updateMany: vi.fn(),
  entry: vi.fn(),
  lock: vi.fn(),
  byKey: vi.fn(),
  cachedItem: vi.fn(),
  upsertItem: vi.fn(),
  createEntry: vi.fn(),
  lastEntry: vi.fn(),
  tableEntries: vi.fn(),
  tx: null as unknown,
}));
mocks.tx = {
  // The first findFirst asks whether the item is on the tier's table; one by bossId asks for the last position.
  lootTableEntry: { findFirst: (q: { where: { bossId?: string } }) => (q.where.bossId ? mocks.lastEntry(q) : mocks.entry(q)), create: mocks.createEntry },
  lootAward: { create: mocks.create, findUnique: mocks.byKey },
  lootBoss: { findFirst: mocks.boss },
  lootItem: { upsert: mocks.upsertItem },
};

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot, openUntilStart: () => false }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer-user' }) }));
vi.mock('@/lib/loot-blocks', () => ({ lockReserveTier: mocks.lock }));
vi.mock('@/lib/loot-data', () => ({ tableItemIds: mocks.items }));
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => unknown) => fn(mocks.tx),
    raid: { findUnique: mocks.raid },
    lootBoss: { findFirst: mocks.boss },
    character: { findUnique: mocks.character },
    lootAward: { create: mocks.create, findFirst: mocks.findAward, updateMany: mocks.updateMany, findUnique: mocks.byKey },
    lootItem: { findUnique: mocks.cachedItem },
    lootTableEntry: { findMany: mocks.tableEntries },
  },
}));

import { POST } from './route';
import { PATCH } from './[awardId]/route';
import { GET as lookup } from './lookup/route';
import { NOT_FOREVER } from '@/lib/loot-rules';

const req = (method: string, body: unknown) => new Request('https://example.test', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const record = (body: unknown) => POST(req('POST', body), { params: Promise.resolve({ id: 'r1' }) });
const voidIt = (body: unknown) => PATCH(req('PATCH', body), { params: Promise.resolve({ id: 'r1', awardId: 'a1' }) });
const WIN = { bossId: 'b1', itemId: 100, characterId: 'c1', method: 'HR', roll: 87, note: '' };
const LINK = 'https://www.wowhead.com/forever/item=231044/whelp-scale-bracers-of-the-brood-mother';
const UNLISTED = { bossId: 'b1', itemRef: LINK, characterId: 'c1', method: 'OPEN_ROLL', roll: 64, requestKey: 'submission-1' };
const BRACERS = { name: 'Whelp-Scale Bracers of the Brood Mother', quality: 4, icon: 'inv_bracer_13', tooltip: '<b>Bracers</b>' };
const find = (ref: string) => lookup(new Request(`https://example.test/api/raids/r1/loot/lookup?item=${encodeURIComponent(ref)}`), { params: Promise.resolve({ id: 'r1' }) });
const wowhead = vi.fn();

beforeEach(() => {
  mocks.session = { role: 'officer', discordId: 'd9' };
  mocks.loot = true;
  for (const m of [mocks.raid, mocks.items, mocks.boss, mocks.character, mocks.create, mocks.findAward, mocks.updateMany, mocks.entry, mocks.lock, mocks.byKey, mocks.cachedItem, mocks.upsertItem, mocks.createEntry, mocks.lastEntry, mocks.tableEntries, wowhead]) m.mockReset();
  vi.stubGlobal('fetch', wowhead);
  wowhead.mockImplementation(async () => new Response(JSON.stringify(BRACERS), { status: 200 }));
  mocks.byKey.mockResolvedValue(null);
  mocks.cachedItem.mockResolvedValue(null);
  mocks.upsertItem.mockImplementation(async (q: { create: unknown }) => q.create);
  mocks.lastEntry.mockResolvedValue({ position: 25 });
  mocks.tableEntries.mockResolvedValue([]);
  mocks.entry.mockResolvedValue({ itemId: 100 });
  mocks.raid.mockResolvedValue({ cancelledAt: null, templateId: 't1' });
  mocks.items.mockResolvedValue(new Set([100]));
  mocks.boss.mockResolvedValue({ name: 'Ragnaros' });
  mocks.character.mockResolvedValue({ name: 'Addendum', userId: 'u2' });
  mocks.create.mockResolvedValue({ id: 'a1' });
  mocks.findAward.mockResolvedValue({ voidedAt: null });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe('POST /api/raids/[id]/loot', () => {
  it('records a win with the names copied and the officer as recorder', async () => {
    const res = await record(WIN);
    expect(res.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toEqual({ raidId: 'r1', bossId: 'b1', bossName: 'Ragnaros', itemId: 100, characterId: 'c1', characterName: 'Addendum', userId: 'u2', method: 'HR', roll: 87, note: null, recordedById: 'officer-user', requestKey: null });
    expect(await res.json()).toEqual({ id: 'a1', addedToTable: false });
    expect(mocks.createEntry).not.toHaveBeenCalled();
  });

  it('refuses, under the tier lock, an item removed after the first check', async () => {
    mocks.entry.mockResolvedValue(null);
    const res = await record(WIN);
    expect(res.status).toBe(409);
    expect(mocks.lock).toHaveBeenCalledWith(mocks.tx, 't1');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('takes no lock for a raid with no loot table', async () => {
    mocks.raid.mockResolvedValue({ cancelledAt: null, templateId: null });
    expect((await record(WIN)).status).toBe(409);
    expect(mocks.lock).not.toHaveBeenCalled();
  });

  it('records disenchant/bank with no character', async () => {
    expect((await record({ itemId: 100, method: 'DISENCHANT_BANK' })).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ characterId: null, characterName: null, userId: null, bossId: null });
  });

  it('is officer-only and 404s with the flag off', async () => {
    mocks.session = { role: 'member', discordId: 'd1' };
    expect((await record(WIN)).status).toBe(403);
    mocks.loot = false;
    expect((await record(WIN)).status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('refuses cancelled raids, items outside the table, foreign bosses and unknown characters', async () => {
    mocks.raid.mockResolvedValueOnce({ cancelledAt: new Date(), templateId: 't1' });
    expect((await record(WIN)).status).toBe(409);
    expect((await record({ ...WIN, itemId: 999 })).status).toBe(409);
    mocks.boss.mockResolvedValueOnce(null);
    expect((await record(WIN)).status).toBe(400);
    mocks.character.mockResolvedValueOnce(null);
    expect((await record(WIN)).status).toBe(404);
    expect((await record({ ...WIN, roll: 500 })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/raids/[id]/loot with an unlisted drop', () => {
  beforeEach(() => mocks.entry.mockResolvedValue(null));

  it('fetches the Forever item, adds it to the end of the boss’s list and records it, in one transaction', async () => {
    const res = await record(UNLISTED);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'a1', addedToTable: true });
    expect(wowhead.mock.calls[0][0]).toBe('https://nether.wowhead.com/forever/tooltip/item/231044');
    expect(mocks.lock).toHaveBeenCalledWith(mocks.tx, 't1');
    expect(mocks.upsertItem.mock.calls[0][0]).toMatchObject({ where: { id: 231044, source: 'FOREVER' }, create: { id: 231044, source: 'FOREVER', name: BRACERS.name, quality: 4, icon: 'inv_bracer_13', tooltipHtml: '<b>Bracers</b>' } });
    expect(mocks.createEntry).toHaveBeenCalledWith({ data: { bossId: 'b1', itemId: 231044, position: 26 } });
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ raidId: 'r1', bossId: 'b1', bossName: 'Ragnaros', itemId: 231044, method: 'OPEN_ROLL', roll: 64, requestKey: 'submission-1' });
  });

  it('records an item already on the tier’s table with no second table entry, and no Wowhead call when cached', async () => {
    mocks.entry.mockResolvedValue({ itemId: 231044 });
    mocks.cachedItem.mockResolvedValue({ id: 231044, ...BRACERS, tooltipHtml: '', source: 'FOREVER' });
    const res = await record(UNLISTED);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: 'a1', addedToTable: false });
    expect(wowhead).not.toHaveBeenCalled();
    expect(mocks.upsertItem).not.toHaveBeenCalled();
    expect(mocks.createEntry).not.toHaveBeenCalled();
  });

  it.each([
    ['not found', () => new Response(JSON.stringify({ error: 'Entity not found' }), { status: 404 }), 404, 'not-found', 'Wowhead Forever has no item 231044. Check the link.'],
    ['down', () => new Response('', { status: 503 }), 502, 'wowhead-down', 'Couldn’t reach Wowhead.'],
    ['unreachable', () => { throw new TypeError('fetch failed'); }, 502, 'wowhead-down', 'Couldn’t reach Wowhead.'],
  ])('saves nothing when Wowhead is %s', async (_name, answer, status, code, error) => {
    wowhead.mockImplementation(async () => answer());
    const res = await record(UNLISTED);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error, code });
    expect(mocks.lock).not.toHaveBeenCalled();
    for (const write of [mocks.upsertItem, mocks.createEntry, mocks.create]) expect(write).not.toHaveBeenCalled();
  });

  it('refuses a boss from another raid tier before asking Wowhead', async () => {
    mocks.boss.mockResolvedValue(null);
    const res = await record({ ...UNLISTED, bossId: 'other-tier-boss' });
    expect(res.status).toBe(400);
    expect(mocks.boss.mock.calls[0][0].where).toEqual({ id: 'other-tier-boss', templateId: 't1' });
    expect(wowhead).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('refuses a boss removed from the tier while Wowhead answered, saving nothing', async () => {
    mocks.boss.mockResolvedValueOnce({ name: 'Ragnaros' }).mockResolvedValueOnce(null);
    expect((await record(UNLISTED)).status).toBe(409);
    for (const write of [mocks.upsertItem, mocks.createEntry, mocks.create]) expect(write).not.toHaveBeenCalled();
  });

  it.each([
    ['production', 'https://www.wowhead.com/classic/item=231044'],
    ['development', 'https://www.wowhead.com/classic/item=231044'],
    ['production', 'https://evil.example/forever/item=231044'],
  ])('refuses a non-Forever link in %s: %s', async (env, link) => {
    vi.stubEnv('VERCEL_ENV', env);
    const res = await record({ ...UNLISTED, itemRef: link });
    vi.unstubAllEnvs();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: NOT_FOREVER, code: 'not-forever' });
    expect(wowhead).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('refuses an id the site saved as a Classic item', async () => {
    mocks.cachedItem.mockResolvedValue({ id: 231044, ...BRACERS, tooltipHtml: '', source: 'CLASSIC' });
    const res = await record(UNLISTED);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'not-forever' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('records the same request key once: a retry answers with the first record', async () => {
    mocks.byKey.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue({ id: 'a1', raidId: 'r1' });
    expect((await record(UNLISTED)).status).toBe(201);
    const retry = await record(UNLISTED);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toEqual({ id: 'a1', replayed: true });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(wowhead).toHaveBeenCalledTimes(1);
  });

  it('finds a retry that raced the first submission under the tier lock', async () => {
    mocks.byKey.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'a1', raidId: 'r1' });
    const res = await record(UNLISTED);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'a1', replayed: true });
    for (const write of [mocks.upsertItem, mocks.createEntry, mocks.create]) expect(write).not.toHaveBeenCalled();
  });

  it('answers why when the save fails, finding a retry that collided on its key', async () => {
    const collision = Object.assign(new Error('unique'), { code: 'P2002' });
    mocks.create.mockRejectedValueOnce(collision);
    mocks.byKey.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'a1', raidId: 'r1' });
    const replayed = await record(UNLISTED);
    expect(replayed.status).toBe(200);
    expect(await replayed.json()).toEqual({ id: 'a1', replayed: true });

    mocks.create.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: 'P2003' }));
    const changed = await record(UNLISTED);
    expect(changed.status).toBe(409);
    expect(await changed.json()).toEqual({ error: 'Something changed while it was saving, so nothing was saved. Try again.' });

    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    mocks.create.mockRejectedValueOnce(new Error('db down'));
    const failed = await record(UNLISTED);
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'Couldn’t save that, so nothing was saved. Try again.' });
  });

  it('refuses a request key already used on another raid', async () => {
    mocks.byKey.mockResolvedValue({ id: 'a9', raidId: 'other-raid' });
    expect((await record(UNLISTED)).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('records two distinct submissions of the same item twice', async () => {
    mocks.entry.mockResolvedValueOnce(null).mockResolvedValueOnce({ itemId: 231044 });
    expect((await record(UNLISTED)).status).toBe(201);
    expect((await record({ ...UNLISTED, requestKey: 'submission-2' })).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.createEntry).toHaveBeenCalledTimes(1);
  });

  it('needs a boss and a request key, and a raid with a loot table', async () => {
    expect((await record({ ...UNLISTED, bossId: undefined })).status).toBe(400);
    expect((await record({ ...UNLISTED, requestKey: undefined })).status).toBe(400);
    mocks.raid.mockResolvedValue({ cancelledAt: null, templateId: null });
    expect((await record(UNLISTED)).status).toBe(409);
    expect(wowhead).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/raids/[id]/loot/lookup', () => {
  it('finds a new item on Wowhead Forever and saves nothing', async () => {
    const res = await find(LINK);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item: { id: 231044, name: BRACERS.name, quality: 4, icon: 'inv_bracer_13', tooltipHtml: '<b>Bracers</b>' }, onTable: [] });
    expect(mocks.tableEntries.mock.calls[0][0].where).toEqual({ itemId: 231044, boss: { templateId: 't1' } });
    for (const write of [mocks.upsertItem, mocks.createEntry, mocks.create, mocks.lock]) expect(write).not.toHaveBeenCalled();
  });

  it('reports an item already on the table, with its bosses, without asking Wowhead', async () => {
    const item = { id: 18205, name: 'Eskhandar’s Collar', quality: 4, icon: 'inv_jewelry_necklace_17', tooltipHtml: '' };
    mocks.tableEntries.mockResolvedValue([{ boss: { id: 'b1', name: 'Onyxia' }, item }]);
    const res = await find('18205');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ item, onTable: [{ bossId: 'b1', bossName: 'Onyxia' }] });
    expect(wowhead).not.toHaveBeenCalled();
  });

  it.each([
    ['a Classic link', 'https://www.wowhead.com/classic/item=18205', undefined, 400, 'not-forever'],
    ['plain text', 'bracers', undefined, 400, 'not-forever'],
    ['an id Wowhead lacks', '999999', () => new Response(JSON.stringify({ error: 'Entity not found' }), { status: 404 }), 404, 'not-found'],
    ['Wowhead down', '231044', () => new Response('', { status: 500 }), 502, 'wowhead-down'],
  ])('answers %s with its own code', async (_name, ref, answer, status, code) => {
    if (answer) wowhead.mockImplementation(async () => answer());
    const res = await find(ref);
    expect(res.status).toBe(status);
    expect(await res.json()).toMatchObject({ code });
  });

  it('is officer-only, and refuses unknown, cancelled and table-less raids', async () => {
    mocks.session = { role: 'member', discordId: 'd1' };
    expect((await find(LINK)).status).toBe(403);
    mocks.session = { role: 'officer', discordId: 'd9' };
    mocks.raid.mockResolvedValueOnce(null);
    expect((await find(LINK)).status).toBe(404);
    mocks.raid.mockResolvedValueOnce({ cancelledAt: new Date(), templateId: 't1' });
    expect((await find(LINK)).status).toBe(409);
    mocks.raid.mockResolvedValueOnce({ cancelledAt: null, templateId: null });
    expect((await find(LINK)).status).toBe(409);
    expect(wowhead).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/raids/[id]/loot/[awardId]', () => {
  it('voids once, keeping the record', async () => {
    expect((await voidIt({ reason: ' wrong person ' })).status).toBe(200);
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'a1', voidedAt: null }, data: { voidedById: 'officer-user', voidReason: 'wrong person' } });
    mocks.findAward.mockResolvedValue({ voidedAt: new Date() });
    expect((await voidIt({})).status).toBe(409);
  });

  it('answers 409 when another officer voided it first, 404 for another raid’s record', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await voidIt({})).status).toBe(409);
    mocks.findAward.mockResolvedValue(null);
    expect((await voidIt({})).status).toBe(404);
  });
});
