import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({
  session: null as { role: string } | null,
  loot: true,
  template: vi.fn(),
  lastBoss: vi.fn(),
  createBoss: vi.fn(),
  boss: vi.fn(),
  item: vi.fn(),
  lastEntry: vi.fn(),
  createEntry: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/loot-items', () => ({ refreshItems: mocks.refresh }));
vi.mock('@/lib/db', () => ({
  db: {
    raidTemplate: { findUnique: mocks.template },
    lootBoss: { findFirst: mocks.lastBoss, create: mocks.createBoss, findUnique: mocks.boss },
    lootItem: { findUnique: mocks.item },
    lootTableEntry: { findFirst: mocks.lastEntry, create: mocks.createEntry },
  },
}));

import { POST as addBoss } from './tables/[templateId]/bosses/route';
import { POST as addItem } from './bosses/[bossId]/items/route';

const json = (body: unknown) => new Request('https://example.test/api/loot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const bossCall = (body: unknown) => addBoss(json(body), { params: Promise.resolve({ templateId: 't1' }) });
const itemCall = (body: unknown) => addItem(json(body), { params: Promise.resolve({ bossId: 'b1' }) });
const unique = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' });

beforeEach(() => {
  mocks.session = { role: 'officer' };
  mocks.loot = true;
  for (const m of [mocks.template, mocks.lastBoss, mocks.createBoss, mocks.boss, mocks.item, mocks.lastEntry, mocks.createEntry, mocks.refresh]) m.mockReset();
  mocks.template.mockResolvedValue({ id: 't1' });
  mocks.boss.mockResolvedValue({ id: 'b1' });
});

describe('POST /api/loot/tables/[templateId]/bosses', () => {
  it('adds a boss after the last one', async () => {
    mocks.lastBoss.mockResolvedValue({ position: 4 });
    mocks.createBoss.mockResolvedValue({ id: 'b9', name: 'Ragnaros' });
    const res = await bossCall({ name: ' Ragnaros ' });
    expect(res.status).toBe(201);
    expect(mocks.createBoss).toHaveBeenCalledWith({ data: { templateId: 't1', name: 'Ragnaros', isTrash: false, position: 5 }, select: { id: true, name: true } });
  });

  it('is a 404 for everyone while the loot flag is off', async () => {
    mocks.loot = false;
    expect((await bossCall({ name: 'Ragnaros' })).status).toBe(404);
    mocks.session = null;
    expect((await bossCall({ name: 'Ragnaros' })).status).toBe(404);
    expect(mocks.createBoss).not.toHaveBeenCalled();
  });

  it('is for officers only', async () => {
    mocks.session = null;
    expect((await bossCall({ name: 'Ragnaros' })).status).toBe(401);
    mocks.session = { role: 'member' };
    expect((await bossCall({ name: 'Ragnaros' })).status).toBe(403);
  });

  it('refuses a missing name, an unknown tier and a duplicate', async () => {
    expect((await bossCall({})).status).toBe(400);
    mocks.template.mockResolvedValueOnce(null);
    expect((await bossCall({ name: 'Ragnaros' })).status).toBe(404);
    mocks.createBoss.mockRejectedValue(unique());
    const res = await bossCall({ name: 'Ragnaros' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This raid already has a boss with that name.' });
  });
});

describe('POST /api/loot/bosses/[bossId]/items', () => {
  it('fetches an uncached item once, then adds it at the end', async () => {
    mocks.item.mockResolvedValueOnce(null).mockResolvedValue({ id: 17076, name: "Bonereaver's Edge" });
    mocks.refresh.mockResolvedValue({ saved: [17076], failed: [] });
    mocks.lastEntry.mockResolvedValue({ position: 2 });
    const res = await itemCall({ ref: 'https://www.wowhead.com/classic/item=17076' });
    expect(res.status).toBe(201);
    expect(mocks.refresh).toHaveBeenCalledWith(expect.anything(), [{ id: 17076, source: 'CLASSIC' }], { gapMs: 0 });
    expect(mocks.createEntry).toHaveBeenCalledWith({ data: { bossId: 'b1', itemId: 17076, position: 3 } });
  });

  it('skips Wowhead for an item cached from the same database', async () => {
    mocks.item.mockResolvedValue({ source: 'FOREVER', id: 5, name: 'X' });
    expect((await itemCall({ ref: '5', source: 'FOREVER' })).status).toBe(201);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('reports what Wowhead said, and refuses duplicates and bad references', async () => {
    mocks.item.mockResolvedValue(null);
    mocks.refresh.mockResolvedValue({ saved: [], failed: [{ id: 5, error: 'Entity not found' }] });
    const res = await itemCall({ ref: '5', source: 'FOREVER' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Wowhead: Entity not found' });
    expect(mocks.createEntry).not.toHaveBeenCalled();

    mocks.item.mockResolvedValue({ source: 'CLASSIC' });
    mocks.createEntry.mockRejectedValue(unique());
    expect((await itemCall({ ref: '5', source: 'CLASSIC' })).status).toBe(409);
    expect((await itemCall({ ref: 'nope', source: 'CLASSIC' })).status).toBe(400);
  });
});
