import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ user: vi.fn(), character: vi.fn(), switchCharacter: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: m.user }, character: { findUnique: m.character } } }));
vi.mock('@/lib/character-switch', () => ({ switchCharacter: m.switchCharacter }));
import { PUT } from './route';

const discordId = '100000000000000001';
const alt = { id: 'alt', name: 'Sample Alt', class: 'PRIEST', spec: 'Holy', raidRole: 'HEALER' };
const call = () => PUT(new Request('https://example.test/api/bot/raids/raid/character', {
  method: 'PUT', headers: { authorization: 'Bearer test-secret' }, body: JSON.stringify({ discordId, characterId: 'alt' }),
}), { params: Promise.resolve({ id: 'raid' }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BOT_SHARED_SECRET', 'test-secret');
  m.user.mockResolvedValue({ id: 'member', role: 'MEMBER' });
  m.switchCharacter.mockResolvedValue({ ok: true, character: alt, removed: [] });
});

it.each([
  ['unknown', { level: null, levelCheckedAt: null }, null, false],
  ['older than 30 days', { level: 40, levelCheckedAt: new Date(Date.now() - 31 * 86_400_000) }, null, false],
  ['59', { level: 59, levelCheckedAt: new Date() }, 59, true],
  ['60', { level: 60, levelCheckedAt: new Date() }, 60, false],
])('gives the brought character its level: %s (#569)', async (_label, stored, level, underRaidLevel) => {
  m.character.mockResolvedValue(stored);
  const response = await call();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    character: { id: 'alt', name: 'Sample Alt', wowClass: 'priest', spec: 'Holy', raidRole: 'healer', level, underRaidLevel },
    removedReserves: [],
  });
  expect(m.character).toHaveBeenCalledWith({ where: { id: 'alt' }, select: { level: true, levelCheckedAt: true } });
});

it('reads a character deleted since the switch as unknown', async () => {
  m.character.mockResolvedValue(null);
  expect((await (await call()).json()).character).toMatchObject({ level: null, underRaidLevel: false });
});
