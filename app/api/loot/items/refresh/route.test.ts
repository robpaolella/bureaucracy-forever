import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ loot: true, findMany: vi.fn(), findUnique: vi.fn(), refresh: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/loot-items', () => ({ refreshItems: mocks.refresh }));
vi.mock('@/lib/db', () => ({ db: { lootItem: { findMany: mocks.findMany, findUnique: mocks.findUnique } } }));

import { POST } from './route';

const call = (body: unknown) => POST(new Request('https://example.test/api/loot/items/refresh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, source: 'CLASSIC' as const }));

beforeEach(() => {
  mocks.loot = true;
  mocks.findMany.mockReset();
  mocks.findUnique.mockReset();
  mocks.refresh.mockReset();
});

describe('POST /api/loot/items/refresh', () => {
  it('refreshes the first batch of a tier and starts a round', async () => {
    mocks.findMany.mockResolvedValue(items(45));
    mocks.refresh.mockImplementation(async (_db, targets: { id: number }[]) => ({ saved: targets.slice(1).map((t) => t.id), failed: [{ id: targets[0].id, error: 'Entity not found' }], notReached: [] }));
    const res = await call({ templateId: 't1' });
    const json = await res.json();
    expect(mocks.refresh.mock.calls[0][1]).toHaveLength(30);
    expect(json).toMatchObject({ saved: 29, failed: [{ id: 1, error: 'Entity not found' }], remaining: 15 });
    expect(typeof json.round).toBe('string');
  });

  it('continues a round, leaving out ids that already failed', async () => {
    mocks.findMany.mockResolvedValue(items(10));
    mocks.refresh.mockResolvedValue({ saved: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], failed: [], notReached: [] });
    const round = '2026-09-29T18:00:00.000Z';
    const json = await (await call({ templateId: 't1', round, skip: [99, 'x'] })).json();
    expect(json).toMatchObject({ saved: 10, remaining: 0, round });
    expect(mocks.findMany.mock.calls[0][0].where).toMatchObject({ fetchedAt: { lt: new Date(round) }, id: { notIn: [99] } });
  });

  it('counts items the deadline cut off as remaining', async () => {
    mocks.findMany.mockResolvedValue(items(30));
    mocks.refresh.mockResolvedValue({ saved: [1, 2], failed: [], notReached: items(30).slice(2).map((i) => i.id) });
    expect(await (await call({ templateId: 't1' })).json()).toMatchObject({ saved: 2, remaining: 28 });
    expect(mocks.refresh.mock.calls[0][2]).toMatchObject({ deadline: expect.any(Number) });
  });

  it('refreshes one item, and reports a Wowhead failure', async () => {
    mocks.findUnique.mockResolvedValue({ id: 5, source: 'FOREVER' });
    mocks.refresh.mockResolvedValueOnce({ saved: [5], failed: [], notReached: [] });
    expect((await call({ itemId: 5 })).status).toBe(200);
    mocks.refresh.mockResolvedValueOnce({ saved: [], failed: [{ id: 5, error: 'Entity not found' }], notReached: [] });
    expect((await call({ itemId: 5 })).status).toBe(502);
    mocks.findUnique.mockResolvedValue(null);
    expect((await call({ itemId: 6 })).status).toBe(404);
  });

  it('refuses an empty body, and 404s with the flag off', async () => {
    expect((await call({})).status).toBe(400);
    mocks.loot = false;
    expect((await call({ templateId: 't1' })).status).toBe(404);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
