import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as { role: string } | null,
  loot: true,
  entry: vi.fn(),
  setBlocked: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/db', () => ({ db: { lootTableEntry: { findFirst: mocks.entry } } }));
vi.mock('@/lib/loot-blocks', () => ({ setItemBlocked: mocks.setBlocked }));

import { PUT } from './route';

const call = (body: unknown, itemId = '100') =>
  PUT(new Request('https://example.test/api/loot', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ templateId: 't1', itemId }) });

beforeEach(() => {
  mocks.session = { role: 'officer' };
  mocks.loot = true;
  mocks.entry.mockReset().mockResolvedValue({ itemId: 100 });
  mocks.setBlocked.mockReset().mockResolvedValue({ ok: true });
});

describe('PUT /api/loot/tables/[templateId]/items/[itemId]', () => {
  it.each([true, false])('sets blocked=%s for the item across the tier', async (blocked) => {
    const res = await call({ blocked });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ itemId: 100, blocked });
    expect(mocks.entry).toHaveBeenCalledWith({ where: { itemId: 100, boss: { templateId: 't1' } }, select: { itemId: true } });
    expect(mocks.setBlocked).toHaveBeenCalledWith('t1', 100, blocked);
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
  });

  it('refuses a block while someone holds the item on a raid that has not locked', async () => {
    mocks.setBlocked.mockResolvedValue({ ok: false, holders: 1 });
    const res = await call({ blocked: true });
    expect(res.status).toBe(409);
    expect((await res.json()).holders).toBe(1);
  });

  it('refuses a missing setting, a bad id and an item not on this tier, without writing', async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ blocked: 'yes' })).status).toBe(400);
    expect((await call({ blocked: true }, 'abc')).status).toBe(404);
    mocks.entry.mockResolvedValue(null);
    expect((await call({ blocked: true })).status).toBe(404);
    expect(mocks.setBlocked).not.toHaveBeenCalled();
  });

  it('lets a failed save surface as an error, so the setting is left as it was', async () => {
    mocks.setBlocked.mockRejectedValue(new Error('connection lost'));
    await expect(call({ blocked: true })).rejects.toThrow('connection lost');
  });
});
