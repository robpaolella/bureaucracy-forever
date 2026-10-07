import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signups: vi.fn(), awards: vi.fn(), reserves: vi.fn(), bosses: vi.fn(), blocked: vi.fn(), limits: vi.fn(), raid: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { signup: { findMany: mocks.signups }, lootAward: { findMany: mocks.awards }, reserve: { findMany: mocks.reserves }, lootBoss: { findMany: mocks.bosses }, raid: { findUnique: mocks.raid } } }));
vi.mock('@/lib/loot-blocks', () => ({ blockedItemIds: mocks.blocked, winLimits: mocks.limits }));

import { hrAwardsFor, loadActiveReserves, loadLootTable, loadReserveTargets } from './loot-data';
import { decideReserve, resolveDrop, REASONS } from './loot-rules';

const user = (id: string, discordId: string, chars = [{ id: `${id}-c`, name: id, class: 'MAGE', isMain: true }], reserves: { characterId: string; itemId: number; kind: 'HR' | 'SR' }[] = []) => ({ id, discordId, discordName: id, characters: chars, reserves });

beforeEach(() => {
  mocks.signups.mockReset();
  mocks.awards.mockReset().mockResolvedValue([]);
  mocks.reserves.mockReset();
  mocks.limits.mockReset().mockResolvedValue({});
  mocks.raid.mockReset().mockResolvedValue({ templateId: 't1' });
});

describe('loadLootTable', () => {
  const item = (id: number) => ({ id, name: `Item ${id}`, quality: 4, icon: 'inv', tooltipHtml: '' });

  it('carries the tier’s blocked items that are in the table, sorted', async () => {
    mocks.bosses.mockResolvedValue([{ id: 'b1', name: 'Onyxia', isTrash: false, entries: [{ item: item(300) }, { item: item(100) }] }]);
    mocks.blocked.mockResolvedValue(new Set([300, 999, 100]));
    const table = await loadLootTable('t1');
    expect(mocks.blocked).toHaveBeenCalledWith('t1');
    expect(table?.blocked).toEqual([100, 300]);
    expect(table?.bosses).toEqual([{ id: 'b1', name: 'Onyxia', isTrash: false, itemIds: [300, 100] }]);
    expect(table?.winLimits).toEqual({});
  });

  it('carries the tier’s win limits for drop resolution', async () => {
    mocks.bosses.mockResolvedValue([{ id: 'b1', name: 'Onyxia', isTrash: false, entries: [{ item: item(100) }] }]);
    mocks.blocked.mockResolvedValue(new Set());
    mocks.limits.mockResolvedValue({ 100: 2 });
    expect((await loadLootTable('t1'))?.winLimits).toEqual({ 100: 2 });
    expect(mocks.limits).toHaveBeenCalledWith('t1');
  });

  it('is null with no items, blocks or not', async () => {
    mocks.bosses.mockResolvedValue([]);
    mocks.blocked.mockResolvedValue(new Set([100]));
    expect(await loadLootTable('t1')).toBeNull();
  });
});

describe('previous reserve wins', () => {
  it('queries live HR and SR awards for these characters without restricting the raid', async () => {
    await hrAwardsFor(['c1']);
    expect(mocks.awards).toHaveBeenCalledWith({
      where: { characterId: { in: ['c1'] }, method: { in: ['HR', 'SR'] }, voidedAt: null },
      select: { id: true, characterId: true, itemId: true },
    });
  });

  it.each([
    ['HR', null, 'c1', true], ['SR', null, 'c1', true],
    ['OPEN_ROLL', null, 'c1', false], ['DISENCHANT_BANK', null, 'c1', false],
    ['MAIN_SPEC', null, 'c1', false], ['OFF_SPEC', null, 'c1', false],
    ['HR', new Date(), 'c1', false], ['SR', new Date(), 'c1', false],
    ['HR', null, 'c2', false], ['SR', null, 'c2', false],
  ])('%s (voided %s, character %s) blocks both kinds: %s', async (method, voidedAt, characterId, blocked) => {
    mocks.awards.mockImplementation(async ({ where }) =>
      where.method.in.includes(method) && where.voidedAt === voidedAt && where.characterId.in.includes(characterId)
        ? [{ id: 'award', characterId, itemId: 100 }] : []);
    const awards = await hrAwardsFor(['c1']);
    for (const kind of ['HR', 'SR'] as const) {
      const result = decideReserve({ role: 'member' }, { cancelled: false, startsAt: new Date('2030-01-02'), hasLootTable: true },
        { characterId: 'c1', hr: kind === 'HR' ? 100 : null, sr: kind === 'SR' ? 100 : null },
        { response: 'accept', ownCharacterIds: ['c1'], tableItemIds: new Set([100]), hrAwards: awards }, new Date('2030-01-01'));
      expect(result).toEqual(blocked ? { ok: false, status: 409, reason: REASONS.hrReceived } : { ok: true });
      expect(resolveDrop(100, [{ userId: 'u1', characterId: 'c1', itemId: 100, kind }], [], awards).mode).toBe(blocked ? 'OPEN' : kind);
    }
  });

  it('does not query awards for no characters', async () => {
    expect(await hrAwardsFor([])).toEqual([]);
    expect(mocks.awards).not.toHaveBeenCalled();
  });
});

describe('loadReserveTargets', () => {
  it('asks only for the viewer’s own sign-up unless they are an officer', async () => {
    mocks.signups.mockResolvedValue([]);
    await loadReserveTargets('r1', 'd1', false);
    expect(mocks.signups.mock.calls[0][0].where).toEqual({ raidId: 'r1', user: { discordId: 'd1' } });
    await loadReserveTargets('r1', 'd1', true);
    expect(mocks.signups.mock.calls[1][0].where).toEqual({ raidId: 'r1' });
  });

  it('keeps eligible members with characters, the viewer first, with saved picks and HR blocks', async () => {
    mocks.signups.mockResolvedValue([
      { response: 'ACCEPT', user: user('zed', 'd2', undefined, [{ characterId: 'zed-c', itemId: 5, kind: 'SR' }]) },
      { response: 'ABSENT', user: user('amy', 'd3') },
      { response: 'TENTATIVE', user: user('me', 'd1') },
      { response: 'ACCEPT', user: user('nochar', 'd4', []) },
    ]);
    mocks.awards.mockResolvedValue([{ characterId: 'zed-c', itemId: 9 }]);
    const { targets, reason } = await loadReserveTargets('r1', 'd1', true);
    expect(reason).toBeNull();
    expect(targets.map((t) => t.name)).toEqual(['me', 'zed']);
    expect(targets[1]).toMatchObject({ current: { characterId: 'zed-c', hr: null, sr: 5 }, blockedHr: { 'zed-c': [9] }, characters: [{ wowClass: 'mage' }] });
  });

  it.each(['alt', null])('defaults empty reserves to the brought character (%s), not always the main', async (characterId) => {
    mocks.signups.mockResolvedValue([{ response: 'ACCEPT', character: characterId ? { id: characterId } : null, user: user('me', 'd1', [
      { id: 'main', name: 'Main', class: 'MAGE', isMain: true },
      { id: 'alt', name: 'Alt', class: 'MAGE', isMain: false },
    ]) }]);
    expect((await loadReserveTargets('r1', 'd1', false)).targets[0].current).toEqual({ characterId: characterId ?? 'main', hr: null, sr: null });
    expect(mocks.signups.mock.calls[0][0].select.character).toEqual({ select: { id: true } });
  });

  it('marks an item previously won only once the character reaches its win limit', async () => {
    mocks.signups.mockResolvedValue([{ response: 'ACCEPT', user: user('me', 'd1', [{ id: 'c1', name: 'One', class: 'MAGE', isMain: true }, { id: 'c2', name: 'Two', class: 'MAGE', isMain: false }]) }]);
    const won = (characterId: string, itemId: number) => ({ characterId, itemId });
    mocks.awards.mockResolvedValue([won('c1', 100), won('c1', 200), won('c1', 200), won('c2', 100), won('c1', 300)]);
    mocks.limits.mockResolvedValue({ 100: 2, 200: 2 });
    const { targets } = await loadReserveTargets('r1', 'd1', false);
    expect(mocks.raid).toHaveBeenCalledWith({ where: { id: 'r1' }, select: { templateId: true } });
    expect(mocks.limits).toHaveBeenCalledWith('t1');
    // 100: one win of two; 200: two of two; 300: limit 1. c2's single win of 100 is below its limit.
    expect(targets[0].blockedHr).toEqual({ c1: [200, 300] });
  });

  it('uses limit 1 for a raid without a tier', async () => {
    mocks.raid.mockResolvedValue({ templateId: null });
    mocks.signups.mockResolvedValue([{ response: 'ACCEPT', user: user('me', 'd1') }]);
    mocks.awards.mockResolvedValue([{ characterId: 'me-c', itemId: 100 }]);
    expect((await loadReserveTargets('r1', 'd1', false)).targets[0].blockedHr).toEqual({ 'me-c': [100] });
    expect(mocks.limits).not.toHaveBeenCalled();
  });

  it('says why the viewer has nothing to set', async () => {
    mocks.signups.mockResolvedValue([{ response: 'ABSENT', user: user('me', 'd1') }]);
    expect((await loadReserveTargets('r1', 'd1', false)).reason).toBe('notEligible');
    mocks.signups.mockResolvedValue([{ response: 'ACCEPT', user: user('me', 'd1', []) }]);
    expect((await loadReserveTargets('r1', 'd1', false)).reason).toBe('noCharacter');
    mocks.signups.mockResolvedValue([]);
    expect((await loadReserveTargets('r1', 'd1', false)).reason).toBe('notEligible');
  });
});

describe('loadActiveReserves', () => {
  it('asks only for holders whose sign-up is Accept or Tentative', async () => {
    mocks.reserves.mockResolvedValue([]);
    await loadActiveReserves('r1');
    expect(mocks.reserves.mock.calls[0][0].where).toEqual({ raidId: 'r1', user: { signups: { some: { raidId: 'r1', response: { in: ['ACCEPT', 'TENTATIVE'] } } } } });
  });
});
