import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as { role: string } | null,
  loot: true,
  entry: vi.fn(),
  setBlocked: vi.fn(),
  block: vi.fn(),
  holders: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/db', () => ({ db: { lootTableEntry: { findFirst: mocks.entry } } }));
vi.mock('@/lib/loot-blocks', () => ({ setItemBlocked: mocks.setBlocked, blockItem: mocks.block, unlockedHolders: mocks.holders }));

import { GET, PUT } from './route';

const call = (body: unknown, itemId = '100') =>
  PUT(new Request('https://example.test/api/loot', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ templateId: 't1', itemId }) });

beforeEach(() => {
  mocks.session = { role: 'officer' };
  mocks.loot = true;
  mocks.entry.mockReset().mockResolvedValue({ itemId: 100 });
  mocks.setBlocked.mockReset().mockResolvedValue({ ok: true });
  mocks.block.mockReset().mockResolvedValue({ ok: true, removed: 0 });
  mocks.holders.mockReset().mockResolvedValue([]);
});

const HOLDER = { key: 'r1:c1:HR', character: 'Sample', kind: 'HR', raid: { id: 'r1', name: 'Sample raid', startsAt: '2026-10-08T03:00:00.000Z', cancelled: false } };
const read = (itemId = '100') => GET(new Request('https://example.test/api/loot'), { params: Promise.resolve({ templateId: 't1', itemId }) });

describe('PUT /api/loot/tables/[templateId]/items/[itemId]', () => {
  it('unblocks the item across the tier', async () => {
    const res = await call({ blocked: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ itemId: 100, blocked: false });
    expect(mocks.entry).toHaveBeenCalledWith({ where: { itemId: 100, boss: { templateId: 't1' } }, select: { itemId: true } });
    expect(mocks.setBlocked).toHaveBeenCalledWith('t1', 100, false);
    expect(mocks.block).not.toHaveBeenCalled();
  });

  it('blocks directly when nothing is confirmed, and with the confirmed holders when given', async () => {
    let res = await call({ blocked: true });
    expect(await res.json()).toEqual({ itemId: 100, blocked: true, removed: 0 });
    expect(mocks.block).toHaveBeenLastCalledWith('t1', 100, []);
    mocks.block.mockResolvedValue({ ok: true, removed: 1 });
    res = await call({ blocked: true, remove: ['r1:c1:HR'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ itemId: 100, blocked: true, removed: 1 });
    expect(mocks.block).toHaveBeenLastCalledWith('t1', 100, ['r1:c1:HR']);
    expect(mocks.setBlocked).not.toHaveBeenCalled();
  });

  it('answers a changed list with 409 and the current holders', async () => {
    mocks.block.mockResolvedValue({ ok: false, holders: [HOLDER] });
    const res = await call({ blocked: true, remove: [] });
    expect(res.status).toBe(409);
    expect((await res.json()).holders).toEqual([HOLDER]);
  });

  it('reads who would lose a reserve, for officers only, on items of this tier', async () => {
    mocks.holders.mockResolvedValue([HOLDER]);
    const res = await read();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ holders: [HOLDER] });
    expect(mocks.holders).toHaveBeenCalledWith(expect.anything(), 't1', 100, expect.any(Date));
    expect((await read('abc')).status).toBe(404);
    mocks.entry.mockResolvedValue(null);
    expect((await read()).status).toBe(404);
    mocks.session = { role: 'member' };
    expect((await read()).status).toBe(403);
    expect(mocks.holders).toHaveBeenCalledOnce();
  });

  it('is for officers only, and a 404 for everyone while the loot flag is off', async () => {
    mocks.session = null;
    expect((await call({ blocked: true })).status).toBe(401);
    mocks.session = { role: 'member' };
    expect((await call({ blocked: true })).status).toBe(403);
    mocks.session = { role: 'officer' };
    mocks.loot = false;
    expect((await call({ blocked: true })).status).toBe(404);
    expect(mocks.setBlocked).not.toHaveBeenCalled();
    expect(mocks.block).not.toHaveBeenCalled();
  });

  it('refuses a missing setting, a bad id and an item not on this tier, without writing', async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ blocked: 'yes' })).status).toBe(400);
    expect((await call({ blocked: true, remove: 'r1:c1:HR' })).status).toBe(400);
    expect((await call({ blocked: true, remove: [1] })).status).toBe(400);
    expect((await call({ blocked: true }, 'abc')).status).toBe(404);
    mocks.entry.mockResolvedValue(null);
    expect((await call({ blocked: true })).status).toBe(404);
    expect(mocks.setBlocked).not.toHaveBeenCalled();
    expect(mocks.block).not.toHaveBeenCalled();
  });

  it('lets a failed save surface as an error, so the setting is left as it was', async () => {
    mocks.block.mockRejectedValue(new Error('connection lost'));
    await expect(call({ blocked: true })).rejects.toThrow('connection lost');
  });
});
