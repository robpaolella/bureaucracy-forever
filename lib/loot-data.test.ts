import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signups: vi.fn(), awards: vi.fn(), reserves: vi.fn(), raid: vi.fn(), session: vi.fn(), enabled: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { signup: { findMany: mocks.signups }, lootAward: { findMany: mocks.awards }, reserve: { findMany: mocks.reserves }, raid: { findUnique: mocks.raid } } }));
vi.mock('@/lib/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: mocks.enabled }));

import { loadActiveReserves, loadMemberRaidLoot, loadReserveTargets } from './loot-data';

const user = (id: string, discordId: string, chars = [{ id: `${id}-c`, name: id, class: 'MAGE', isMain: true }], reserves: { characterId: string; itemId: number; kind: 'HR' | 'SR' }[] = []) => ({ id, discordId, discordName: id, characters: chars, reserves });

beforeEach(() => {
  mocks.enabled.mockReset().mockReturnValue(true);
  mocks.session.mockReset().mockResolvedValue({ role: 'member' });
  mocks.raid.mockReset().mockResolvedValue({ startsAt: new Date('2026-10-04T20:00:00Z'), durationMin: 180, cancelledAt: null });
  mocks.signups.mockReset();
  mocks.awards.mockReset().mockResolvedValue([]);
  mocks.reserves.mockReset();
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

  it('says why the viewer has nothing to set', async () => {
    mocks.signups.mockResolvedValue([{ response: 'ABSENT', user: user('me', 'd1') }]);
    expect((await loadReserveTargets('r1', 'd1', false)).reason).toBe('notEligible');
    mocks.signups.mockResolvedValue([{ response: 'ACCEPT', user: user('me', 'd1', []) }]);
    expect((await loadReserveTargets('r1', 'd1', false)).reason).toBe('noCharacter');
    mocks.signups.mockResolvedValue([]);
    expect((await loadReserveTargets('r1', 'd1', false)).reason).toBe('notEligible');
  });
});

describe('loadMemberRaidLoot', () => {
  const item = { id: 1, name: 'Test sword', quality: 4, icon: 'inv_sword_01', tooltipHtml: '<b>Sword</b><script>bad()</script>' };

  it.each(['member', 'officer'])('returns only member-safe fields for %s, in recorded order', async (role) => {
    mocks.session.mockResolvedValue({ role });
    mocks.awards.mockResolvedValue([{ id: 'a', item, characterName: 'Redtape', method: 'HR', roll: 99, bossName: 'Boss', note: 'private', recordedById: 'officer', voidReason: 'private' }]);
    const result = await loadMemberRaidLoot('r1');
    expect(result).toEqual({ startsAt: '2026-10-04T20:00:00.000Z', endsAt: '2026-10-04T23:00:00.000Z', awards: [{ id: 'a', item: { ...item, tooltipHtml: '<b>Sword</b>' }, characterName: 'Redtape', method: 'HR', roll: 99, bossName: 'Boss' }] });
    expect(mocks.awards).toHaveBeenCalledWith({
      where: { raidId: 'r1', voidedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, characterName: true, method: true, roll: true, bossName: true, item: { select: { id: true, name: true, quality: true, icon: true, tooltipHtml: true } } },
    });
  });

  it.each([null, { role: 'social' }])('denies an unauthorized viewer before any database read: %j', async (session) => {
    mocks.session.mockResolvedValue(session);
    expect(await loadMemberRaidLoot('r1')).toBeNull();
    expect(mocks.raid).not.toHaveBeenCalled();
    expect(mocks.awards).not.toHaveBeenCalled();
  });

  it('does not read data when the feature is disabled', async () => {
    mocks.enabled.mockReturnValue(false);
    expect(await loadMemberRaidLoot('r1')).toBeNull();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.awards).not.toHaveBeenCalled();
  });

  it.each([null, { startsAt: new Date(), durationMin: 180, cancelledAt: new Date() }])('hides missing or cancelled raids', async (raid) => {
    mocks.raid.mockResolvedValue(raid);
    expect(await loadMemberRaidLoot('r1')).toBeNull();
    expect(mocks.awards).not.toHaveBeenCalled();
  });

  it('supports empty lists and strips characters and rolls from bank awards', async () => {
    expect((await loadMemberRaidLoot('r1'))?.awards).toEqual([]);
    mocks.awards.mockResolvedValue([{ id: 'a', item, characterName: 'stale', method: 'DISENCHANT_BANK', roll: 12, bossName: null }]);
    expect((await loadMemberRaidLoot('r1'))?.awards[0]).toMatchObject({ characterName: null, roll: null, method: 'DISENCHANT_BANK' });
  });
});

describe('loadActiveReserves', () => {
  it('asks only for holders whose sign-up is Accept or Tentative', async () => {
    mocks.reserves.mockResolvedValue([]);
    await loadActiveReserves('r1');
    expect(mocks.reserves.mock.calls[0][0].where).toEqual({ raidId: 'r1', user: { signups: { some: { raidId: 'r1', response: { in: ['ACCEPT', 'TENTATIVE'] } } } } });
  });
});
