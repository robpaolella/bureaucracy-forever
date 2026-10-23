import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The "Reserves allowed" switch (#451) reaches the add-on's snapshot through loadActiveReserves
 * (#452). Here the database is a small fake that applies the loader's `reservesAllowed` filter to
 * stored reserves, and the real loader, snapshot builder and both routes run on top of it.
 */
const state = vi.hoisted(() => ({ reservesAllowed: true }));
const mocks = vi.hoisted(() => ({ release: vi.fn() }));

const stored = [{ userId: 'u_bo', characterId: 'c_bo', itemId: 16800, kind: 'HR', user: { discordName: 'Bo', rank: 'RAIDER' }, character: { name: 'Bo Marsh', class: 'MAGE' } }];

vi.mock('@/lib/db', () => ({
  db: {
    raid: { findUnique: async () => ({ id: 'cm9xr2k4a0001', name: 'Molten Core - sample', startsAt: new Date(1792000000000), durationMin: 240, cancelledAt: null, templateId: 't1', template: { instance: 409 } }) },
    reserve: { findMany: async ({ where }: { where: { raid?: { reservesAllowed?: boolean } } }) => (where.raid?.reservesAllowed === true && !state.reservesAllowed ? [] : stored) },
    lootAward: { findMany: async () => [] },
  },
}));
vi.mock('@/lib/addon-release', async (real) => ({ ...(await real<typeof import('@/lib/addon-release')>()), getAddonRelease: mocks.release }));
vi.mock('@/lib/loot-data', async (real) => ({
  ...(await real<typeof import('@/lib/loot-data')>()),
  loadLootTable: async () => ({ bosses: [{ id: 'lb_lucifron', name: 'Lucifron', isTrash: false, itemIds: [16800] }], winLimits: {}, blocked: [] }),
}));
vi.mock('@/lib/helper-api', async (real) => ({ ...(await real<typeof import('@/lib/helper-api')>()), guardHelperRequest: async () => ({ userId: 'u1' }) }));
vi.mock('../app/api/_loot', () => ({ requireLootOfficer: async () => ({}) }));
vi.mock('../app/api/_officer', () => ({ NO_STORE: { 'Cache-Control': 'private, no-store' } }));

import { loadSnapshot } from '@/lib/addon-snapshot';
import { GET as helperSnapshot } from '../app/api/helper/raids/[raid]/snapshot/route';
import { GET as copySnapshot } from '../app/api/raids/[id]/snapshot/route';

const id = 'cm9xr2k4a0001';
const bosses = [{ id: 'lb_lucifron', name: 'Lucifron', trash: false, items: [16800], encounter: 663 }];

beforeEach(() => {
  state.reservesAllowed = true;
  mocks.release.mockResolvedValue({ status: 'none' });
});

describe('the reserve snapshot and the Reserves allowed switch', () => {
  it('holds the reserves while they are on', async () => {
    const snap = (await loadSnapshot(id))!;
    expect(Object.keys(snap.reserves)).toEqual(['16800']);
    expect(snap.bosses).toEqual(bosses);
  });

  it('has an empty reserves map but the full loot table while they are off, and the reserves return when switched back on', async () => {
    state.reservesAllowed = false;
    const off = (await loadSnapshot(id))!;
    expect(off.reserves).toEqual({});
    expect(off.bosses).toEqual(bosses);
    expect(off.instance).toBe(409);
    state.reservesAllowed = true;
    expect(Object.keys((await loadSnapshot(id))!.reserves)).toEqual(['16800']);
  });

  it('gives the helper API an empty reserves map and the full loot table while they are off', async () => {
    state.reservesAllowed = false;
    const res = await helperSnapshot(new Request('https://example.test/x'), { params: Promise.resolve({ raid: id }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reserves).toEqual({});
    expect(body.bosses).toEqual(bosses);
  });

  it('gives Copy reserves no reserve lines while they are off', async () => {
    const lines = async () => ((await (await copySnapshot(new Request('https://example.test/x'), { params: Promise.resolve({ id }) })).json()) as { parts: string[] }).parts.join('');
    const on = await lines();
    state.reservesAllowed = false;
    const off = await lines();
    expect(on).not.toBe(off);
    expect(off.length).toBeLessThan(on.length);
  });
});
