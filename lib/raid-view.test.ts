import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ raid: vi.fn(), characters: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: mocks.raid }, character: { findMany: mocks.characters } } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false }));
import { loadRaidView } from './raid-view';

const main = { id: 'main', name: 'Samplemain', class: 'WARRIOR', spec: 'Protection', raidRole: 'TANK' };
const alt = { id: 'alt', name: 'Samplealt', class: 'PRIEST', spec: 'Holy', raidRole: 'HEALER' };
const raid = (character: typeof main | null = main, mains = [main]) => ({
  id: 'raid', name: 'Sample raid', status: 'SCHEDULED', startsAt: new Date('2099-01-01'), locksAt: new Date('2099-01-01'),
  durationMin: 180, notes: null, cancelReason: null, postedAt: null, requirements: {}, templateId: null, template: null, series: null,
  discordThreadId: null, discordMessageId: null,
  signups: [{ standing: 'ROSTER', response: 'ACCEPT', attended: null, character,
    user: { discordId: 'member', characters: mains, reserves: [] } }],
});
beforeEach(() => {
  mocks.raid.mockResolvedValue(raid());
  mocks.characters.mockReset().mockResolvedValue([{ ...main, isMain: true }]);
});

it('adds only the brought character for a main-only member', async () => {
  const view = await loadRaidView('raid', 'member');
  expect(view?.viewer?.character).toEqual({ id: 'main', name: 'Samplemain', wowClass: 'warrior', spec: 'Protection', raidRole: 'tank' });
  expect(view?.viewer).not.toHaveProperty('characters');
});
it('reports the saved alt and requests the complete list in main-first, name order', async () => {
  mocks.raid.mockResolvedValue(raid(alt));
  mocks.characters.mockResolvedValue([{ ...main, isMain: true }, { ...alt, isMain: false }]);
  const view = await loadRaidView('raid', 'member');
  expect(view?.viewer?.character).toEqual({ id: 'alt', name: 'Samplealt', wowClass: 'priest', spec: 'Holy', raidRole: 'healer' });
  expect(view?.viewer?.characters).toEqual([
    { id: 'main', name: 'Samplemain', wowClass: 'warrior', spec: 'Protection', raidRole: 'tank', isMain: true },
    { id: 'alt', name: 'Samplealt', wowClass: 'priest', spec: 'Holy', raidRole: 'healer', isMain: false },
  ]);
  expect(mocks.characters).toHaveBeenCalledWith(expect.objectContaining({ where: { user: { discordId: 'member' } }, orderBy: [{ isMain: 'desc' }, { name: 'asc' }] }));
  expect(view?.bars).toEqual({ tank: 0, healer: 1, melee: 0, ranged: 0 });
});
it('falls back to the main for a legacy null choice, never an arbitrary alt', async () => {
  mocks.raid.mockResolvedValue(raid(null));
  expect((await loadRaidView('raid', 'member'))?.viewer?.character?.id).toBe('main');
  mocks.raid.mockResolvedValue(raid(null, []));
  mocks.characters.mockResolvedValue([{ ...alt, isMain: false }]);
  expect((await loadRaidView('raid', 'member'))?.viewer?.character).toBeNull();
});
it.each([null, 'stranger'])('keeps viewer null without a matching sign-up (%s)', async (discordId) => {
  expect((await loadRaidView('raid', discordId))?.viewer).toBeNull();
  expect(mocks.characters).not.toHaveBeenCalled();
});
