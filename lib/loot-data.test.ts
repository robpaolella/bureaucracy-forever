import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ signups: vi.fn(), awards: vi.fn(), reserves: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { signup: { findMany: mocks.signups }, lootAward: { findMany: mocks.awards }, reserve: { findMany: mocks.reserves } } }));

import { loadActiveReserves, loadReserveTargets } from './loot-data';

const user = (id: string, discordId: string, chars = [{ id: `${id}-c`, name: id, class: 'MAGE', isMain: true }], reserves: { characterId: string; itemId: number; kind: 'HR' | 'SR' }[] = []) => ({ id, discordId, discordName: id, characters: chars, reserves });

beforeEach(() => {
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

describe('loadActiveReserves', () => {
  it('asks only for holders whose sign-up is Accept or Tentative', async () => {
    mocks.reserves.mockResolvedValue([]);
    await loadActiveReserves('r1');
    expect(mocks.reserves.mock.calls[0][0].where).toEqual({ raidId: 'r1', user: { signups: { some: { raidId: 'r1', response: { in: ['ACCEPT', 'TENTATIVE'] } } } } });
  });
});
