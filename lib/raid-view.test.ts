import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ raid: vi.fn(), characters: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { raid: { findUnique: mocks.raid }, character: { findMany: mocks.characters } } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false, openUntilStart: () => false }));
import { loadRaidView } from './raid-view';

const main = { id: 'main', name: 'Samplemain', class: 'WARRIOR', spec: 'Protection', raidRole: 'TANK' };
const alt = { id: 'alt', name: 'Samplealt', class: 'PRIEST', spec: 'Holy', raidRole: 'HEALER' };
const raid = (character: Record<string, unknown> | null = main, mains: Record<string, unknown>[] = [main]) => ({
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
  expect(view?.viewer?.character).toEqual({ id: 'main', name: 'Samplemain', wowClass: 'warrior', spec: 'Protection', raidRole: 'tank', level: null, underRaidLevel: false });
  expect(view?.viewer).not.toHaveProperty('characters');
});
it('reports the saved alt and requests the complete list in main-first, name order', async () => {
  mocks.raid.mockResolvedValue(raid(alt));
  mocks.characters.mockResolvedValue([{ ...main, isMain: true }, { ...alt, isMain: false }]);
  const view = await loadRaidView('raid', 'member');
  expect(view?.viewer?.character).toEqual({ id: 'alt', name: 'Samplealt', wowClass: 'priest', spec: 'Holy', raidRole: 'healer', level: null, underRaidLevel: false });
  expect(view?.viewer?.characters).toEqual([
    { id: 'main', name: 'Samplemain', wowClass: 'warrior', spec: 'Protection', raidRole: 'tank', isMain: true },
    { id: 'alt', name: 'Samplealt', wowClass: 'priest', spec: 'Holy', raidRole: 'healer', isMain: false },
  ]);
  expect(mocks.characters).toHaveBeenCalledWith(expect.objectContaining({ where: { user: { discordId: 'member' } }, orderBy: [{ isMain: 'desc' }, { name: 'asc' }] }));
  expect(view?.bars).toEqual({ tank: 0, healer: 1, dps: 0 });
});
it('falls back to the main for a legacy null choice, never an arbitrary alt', async () => {
  mocks.raid.mockResolvedValue(raid(null));
  expect((await loadRaidView('raid', 'member'))?.viewer?.character?.id).toBe('main');
  mocks.raid.mockResolvedValue(raid(null, []));
  mocks.characters.mockResolvedValue([{ ...alt, isMain: false }]);
  expect((await loadRaidView('raid', 'member'))?.viewer?.character).toBeNull();
});
it.each([
  ['unknown', { level: null, levelCheckedAt: null }, null, false],
  ['older than 30 days', { level: 40, levelCheckedAt: new Date(Date.now() - 31 * 86_400_000) }, null, false],
  ['59', { level: 59, levelCheckedAt: new Date() }, 59, true],
  ['60', { level: 60, levelCheckedAt: new Date() }, 60, false],
])('gives the brought character its level for the bot: %s (#569)', async (_label, stored, level, underRaidLevel) => {
  mocks.raid.mockResolvedValue(raid({ ...alt, ...stored }));
  const view = await loadRaidView('raid', 'member');
  expect(view?.viewer?.character).toMatchObject({ id: 'alt', level, underRaidLevel });
  expect(view?.viewer?.character).not.toHaveProperty('levelCheckedAt');
  const select = mocks.raid.mock.calls[0][0].select.signups.select;
  expect(select.character.select).toMatchObject({ level: true, levelCheckedAt: true });
  expect(select.user.select.characters).toMatchObject({ where: { isMain: true }, take: 1, select: { level: true, levelCheckedAt: true } });
});
it.each([null, 'stranger'])('keeps viewer null without a matching sign-up (%s)', async (discordId) => {
  expect((await loadRaidView('raid', discordId))?.viewer).toBeNull();
  expect(mocks.characters).not.toHaveBeenCalled();
});

it('sends requirements and bars as exactly tank, healer and dps', async () => {
  mocks.raid.mockResolvedValue({ ...raid(), requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 } });
  const view = await loadRaidView('raid', null);
  expect(view?.requirements).toEqual({ tank: 2, healer: 8, dps: 20 });
  expect(Object.keys(view!.bars).sort()).toEqual(['dps', 'healer', 'tank']);
  expect(Object.keys(view!.requirements).sort()).toEqual(['dps', 'healer', 'tank']);
});
