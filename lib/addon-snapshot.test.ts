import { describe, expect, it, vi } from 'vitest';
import type { AddonRelease } from '@/lib/addon-release';
import { ADDON_PLACEHOLDER, buildSnapshot, loadSnapshot, raidCode, type SnapshotInput } from '@/lib/addon-snapshot';

// ADDON-SPEC 3.3's worked example, as the database would give it.
const sample = (): SnapshotInput => ({
  raid: { id: 'cm9xr2k4a0001', name: 'Molten Core - sample', startsAt: new Date(1792000000 * 1000), durationMin: 240 },
  env: 'staging',
  now: new Date(1791990000 * 1000),
  bosses: [
    { id: 'lb_lucifron', name: 'Lucifron', trash: false, items: [16800, 16805] },
    { id: 'lb_magmadar', name: 'Magmadar', trash: false, items: [16796, 16805] },
    { id: 'lb_trash', name: 'Trash', trash: true, items: [17011, 18861] },
  ],
  reserves: [
    { userId: 'u_bo', characterId: 'c_bo', characterName: 'Bo Marsh', itemId: 16796, kind: 'HR', onTrial: false },
    { userId: 'u_ana', characterId: 'c_ana', characterName: 'Ana Vale', itemId: 16805, kind: 'HR', onTrial: false },
    { userId: 'u_bo', characterId: 'c_bo', characterName: 'Bo Marsh', itemId: 16805, kind: 'SR', onTrial: false },
    { userId: 'u_cy', characterId: 'c_cy', characterName: 'Cy Orchard', itemId: 16805, kind: 'SR', onTrial: true },
  ],
  winLimits: {},
  earlierWins: [{ characterId: 'c_bo', itemId: 16796 }],
  awards: [{ id: '0001abcd', requestKey: null, bossId: 'lb_trash', itemId: 18861, characterName: 'Dee Holt', userId: 'u_dee', method: 'OPEN_ROLL', roll: 64, voidedAt: null }],
});

const mocks = vi.hoisted(() => ({ release: vi.fn(), raidExtra: vi.fn(() => ({}) as object) }));
vi.mock('@/lib/addon-release', async (original) => ({ ...(await original<typeof import('@/lib/addon-release')>()), getAddonRelease: mocks.release }));
vi.mock('@/lib/db', () => ({
  db: {
    raid: { findUnique: async () => ({ id: 'cm9xr2k4a0001', name: 'Molten Core - sample', startsAt: new Date(1792000000000), durationMin: 240, templateId: null, ...mocks.raidExtra() }) },
    lootAward: { findMany: async () => [] },
  },
}));
vi.mock('@/lib/loot-data', () => ({ loadActiveReserves: async () => [], loadLootTable: async () => null }));

// The example's tree, with `instance` left out (#293) and `addon` the placeholder (#280).
const expected = () => ({
  formatVersion: 1, raid: 'cm9xr2k4a0001', code: 'SA0001', env: 'staging',
  name: 'Molten Core - sample', startsAt: 1792000000, durationMin: 240, generated: 1791990000,
  addon: { version: '', url: 'https://github.com/robpaolella/bureaucracy-forever-addon/releases/latest' },
  bosses: [
    { id: 'lb_lucifron', name: 'Lucifron', trash: false, items: [16800, 16805] },
    { id: 'lb_magmadar', name: 'Magmadar', trash: false, items: [16796, 16805] },
    { id: 'lb_trash', name: 'Trash', trash: true, items: [17011, 18861] },
  ],
  reserves: {
    '16805': [
      { user: 'u_ana', char: 'Ana Vale', kind: 'HR', trial: false },
      { user: 'u_bo', char: 'Bo Marsh', kind: 'SR', trial: false },
      { user: 'u_cy', char: 'Cy Orchard', kind: 'SR', trial: true },
    ],
    '16796': [{ user: 'u_bo', char: 'Bo Marsh', kind: 'HR', trial: false, blocked: 'win-limit' }],
  },
  awards: [{ key: 'site-0001abcd', boss: 'lb_trash', item: 18861, char: 'Dee Holt', user: 'u_dee', method: 'OPEN_ROLL', roll: 64, voided: false }],
});

describe('buildSnapshot', () => {
  it('matches the worked example, without instance and with the placeholder add-on', () => {
    const snap = buildSnapshot(sample());
    expect(snap).toEqual(expected());
    expect('instance' in snap).toBe(false);
    expect(snap.addon).toEqual(ADDON_PLACEHOLDER);
  });

  it('carries the template instance number when set, and leaves it out when not', () => {
    expect(buildSnapshot({ ...sample(), raid: { ...sample().raid, instance: 409 } }).instance).toBe(409);
    expect('instance' in buildSnapshot({ ...sample(), raid: { ...sample().raid, instance: null } })).toBe(false);
  });

  it('carries the add-on version and url from the lookup', () => {
    const addon = { version: '1.2.0', url: 'https://example.test/addon.zip' };
    expect(buildSnapshot({ ...sample(), addon }).addon).toEqual(addon);
  });

  it('marks trial holders, and keeps a win-limit holder listed with the reason', () => {
    const { reserves } = buildSnapshot(sample());
    expect(reserves['16805'].map((h) => h.trial)).toEqual([false, false, true]);
    expect(reserves['16796']).toEqual([expect.objectContaining({ user: 'u_bo', blocked: 'win-limit' })]);
    expect('blocked' in reserves['16805'][0]).toBe(false);
  });

  it('lets a higher win limit keep the holder unblocked', () => {
    const { reserves } = buildSnapshot({ ...sample(), winLimits: { 16796: 2 } });
    expect('blocked' in reserves['16796'][0]).toBe(false);
  });

  it('takes the generated time from the clock it is given', () => {
    expect(buildSnapshot({ ...sample(), now: new Date(1791990123_999) }).generated).toBe(1791990123);
  });

  it('builds the raid code from the environment and the id', () => {
    expect(raidCode('production', 'cm9xr2k4a0001')).toBe('PA0001');
    expect(raidCode('staging', 'cm9xr2k4abcde')).toBe('SABCDE');
  });

  it('keeps voided awards and their keys, and a stored key as it is', () => {
    const input = sample();
    input.awards.push({ id: 'zz', requestKey: 'op-123', bossId: 'lb_trash', itemId: 17011, characterName: 'Dee Holt', userId: 'u_dee', method: 'HR', roll: null, voidedAt: new Date() });
    const { awards } = buildSnapshot(input);
    expect(awards[1]).toEqual({ key: 'op-123', boss: 'lb_trash', item: 17011, char: 'Dee Holt', user: 'u_dee', method: 'HR', voided: true });
  });

  it('gives a key-less award the same site key in every build', () => {
    expect(buildSnapshot(sample()).awards[0].key).toBe('site-0001abcd');
    expect(buildSnapshot(sample()).awards[0].key).toBe(buildSnapshot(sample()).awards[0].key);
  });

  it('leaves out the boss of a deleted boss and the character of a disenchant bank', () => {
    const input = sample();
    input.awards = [{ id: 'a1', requestKey: null, bossId: null, itemId: 1, characterName: 'Dee Holt', userId: 'u_dee', method: 'OPEN_ROLL', roll: 9, voidedAt: null }, { id: 'a2', requestKey: null, bossId: 'lb_trash', itemId: 2, characterName: null, userId: null, method: 'DISENCHANT_BANK', roll: null, voidedAt: null }];
    const [noBoss, bank] = buildSnapshot(input).awards;
    expect('boss' in noBoss).toBe(false);
    expect('char' in bank).toBe(false);
    expect(Object.values(noBoss).concat(Object.values(bank)).includes(null as never)).toBe(false);
  });

  it('still gives bosses, items and baseline awards when nobody reserved', () => {
    const snap = buildSnapshot({ ...sample(), reserves: [] });
    expect(snap.reserves).toEqual({});
    expect(snap.bosses).toHaveLength(3);
    expect(snap.awards).toHaveLength(1);
  });

  it('gives no bosses for a raid with no loot table', () => {
    expect(buildSnapshot({ ...sample(), bosses: [] }).bosses).toEqual([]);
  });
});

describe('loadSnapshot', () => {
  const placeholder = { version: '', url: 'https://github.com/robpaolella/bureaucracy-forever-addon/releases/latest' };
  const load = async (found: AddonRelease) => {
    mocks.release.mockResolvedValue(found);
    return (await loadSnapshot('cm9xr2k4a0001', new Date(1791990000000)))!;
  };

  it('fills addon from the lookup', async () => {
    const release = { version: '1.2.0', publishedAt: '2026-11-03T18:00:00.000Z', downloadUrl: 'https://example.test/addon.zip' };
    expect((await load({ status: 'release', stale: false, release })).addon).toEqual({ version: '1.2.0', url: 'https://example.test/addon.zip' });
    expect((await load({ status: 'release', stale: true, release })).addon.version).toBe('1.2.0');
  });

  it('uses the placeholder when there is no release or none was seen', async () => {
    expect((await load({ status: 'none' })).addon).toEqual(placeholder);
    expect((await load({ status: 'unreachable' })).addon).toEqual(placeholder);
  });

  it('reads the instance from the raid\'s template, and has none without a template', async () => {
    mocks.release.mockResolvedValue({ status: 'none' });
    mocks.raidExtra.mockReturnValueOnce({ template: { instance: 409 } });
    expect((await loadSnapshot('cm9xr2k4a0001'))!.instance).toBe(409);
    mocks.raidExtra.mockReturnValueOnce({ template: { instance: null } });
    expect('instance' in (await loadSnapshot('cm9xr2k4a0001'))!).toBe(false);
    expect('instance' in (await loadSnapshot('cm9xr2k4a0001'))!).toBe(false);
  });
});
