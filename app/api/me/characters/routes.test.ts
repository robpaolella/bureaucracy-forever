import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  session: vi.fn(), user: vi.fn(), existing: vi.fn(), list: vi.fn(), transaction: vi.fn(),
  txUser: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), count: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/db', () => ({ db: {
  user: { findUnique: m.user }, character: { findUnique: m.existing, findMany: m.list }, $transaction: m.transaction,
} }));
vi.mock('@/lib/roles-sync', () => ({ refreshPostedRaidsForCharacter: m.refresh }));
import { GET, POST } from './route';
import { PATCH, DELETE } from './[characterId]/route';

const alt = { id: 'alt', userId: 'owner', name: 'Sample', isMain: false, raidRole: 'TANK' };
const body = { name: 'Sample', wowClass: 'paladin', spec: 'Protection', role: 'tank', rank: 'officer', isMain: true, userId: 'other' };
const tx = { user: { findUnique: m.txUser }, character: {
  findFirst: m.find, create: m.create, update: m.update, delete: m.remove, count: m.count,
} };
const params = { params: Promise.resolve({ characterId: 'alt' }) };
function call(method: string, data: unknown = body) {
  const request = new Request('http://localhost/api/me/characters/alt', {
    method, ...(['POST', 'PATCH'].includes(method) ? { body: JSON.stringify(data) } : {}),
  });
  return method === 'GET' ? GET() : method === 'POST' ? POST(request) : method === 'PATCH' ? PATCH(request, params) : DELETE(request, params);
}
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ discordId: 'discord-owner', role: 'member' });
  m.user.mockResolvedValue({ id: 'owner', inGuild: true });
  m.existing.mockResolvedValue(alt);
  m.list.mockResolvedValue([alt]);
  m.transaction.mockImplementation((run) => run(tx));
  m.txUser.mockResolvedValue({ rank: 'RAIDER', characters: [{ isMain: true }] });
  m.find.mockResolvedValue(null);
  m.create.mockResolvedValue(alt);
  m.update.mockResolvedValue(alt);
  m.remove.mockResolvedValue(alt);
});

it.each(['GET', 'POST', 'PATCH', 'DELETE'])('%s refuses signed-out callers before database access', async (method) => {
  m.session.mockResolvedValue(null);
  const response = await call(method);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Log in first.' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(m.user).not.toHaveBeenCalled();
  expect(m.existing).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(['member', 'officer', 'social'])('%s with a main can list, add, edit and remove their own alts', async (role) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role });
  // inGuild records Member/Officer roles, not Discord presence: socials are false.
  m.user.mockResolvedValue({ id: 'owner', inGuild: role !== 'social' });
  const rank = role === 'social' ? 'SOCIAL' : role === 'officer' ? 'OFFICER' : 'RAIDER';
  m.txUser.mockResolvedValue({ rank, characters: [{ isMain: true }] });
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    m.find.mockReset().mockResolvedValue(null);
    if (method === 'PATCH' || method === 'DELETE') m.find.mockResolvedValueOnce(alt);
    const response = await call(method);
    expect(response.status).toBe(method === 'POST' ? 201 : 200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(method === 'GET' ? [alt] : { id: 'alt', name: 'Sample' });
  }
  expect(m.user).toHaveBeenCalledWith({ where: { discordId: 'discord-owner' }, select: { id: true } });
  expect(m.list).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
  // Neither supplied userId, isMain nor rank is writable, including by officers here.
  expect(m.create).toHaveBeenCalledWith({ data: { name: 'Sample', class: 'PALADIN', spec: 'Protection', raidRole: 'TANK', userId: 'owner', isMain: false, rank } });
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'alt' }, data: { name: 'Sample', class: 'PALADIN', spec: 'Protection', raidRole: 'TANK' } });
  expect(m.find).toHaveBeenCalledWith({ where: { id: 'alt', userId: 'owner' } });
  expect(m.refresh).toHaveBeenCalledWith(alt, tx);
});
it.each(['PATCH', 'DELETE'])('%s refuses another owner and the main; unknown ids are 404', async (method) => {
  for (const [existing, status] of [[{ ...alt, userId: 'other' }, 403], [{ ...alt, isMain: true }, 403], [null, 404]] as const) {
    m.existing.mockResolvedValue(existing);
    const response = await call(method);
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(m.transaction).not.toHaveBeenCalled();
});
it('refuses the ninth character without creating one', async () => {
  m.txUser.mockResolvedValue({ rank: 'RAIDER', characters: Array(8).fill({ isMain: true }) });
  const response = await call('POST');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'You can have up to 8 characters.' });
  expect(m.create).not.toHaveBeenCalled();
});
it.each(['member', 'officer', 'social'])('%s without a main gets the member-facing message', async (role) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role });
  m.txUser.mockResolvedValue({ characters: [] });
  const response = await call('POST');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Set your main first.' });
  expect(m.create).not.toHaveBeenCalled();
});
it('handles a signed-in account with no database user without creating a user', async () => {
  m.user.mockResolvedValue(null);
  expect(await (await GET()).json()).toEqual([]);
  const response = await call('POST');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Set your main first.' });
  expect((await call('PATCH')).status).toBe(403);
  expect((await call('DELETE')).status).toBe(403);
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(['POST', 'PATCH'])('%s rejects malformed JSON and invalid fields without writing', async (method) => {
  for (const data of [null, {}, { ...body, name: '' }]) expect((await call(method, data)).status).toBe(400);
  const request = new Request('http://localhost/api/me/characters', { method, body: '{' });
  expect((await (method === 'POST' ? POST(request) : PATCH(request, params))).status).toBe(400);
  expect(m.transaction).not.toHaveBeenCalled();
});
it('preserves name conflicts and successful add retries from the shared rules', async () => {
  m.find.mockResolvedValue({ ...alt, userId: 'other' });
  const response = await call('POST');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'That name is taken by another member.' });
  m.find.mockResolvedValue(alt);
  expect((await call('POST')).status).toBe(200);
  expect(m.create).not.toHaveBeenCalled();
});
it.each(['PATCH', 'DELETE'])('%s preserves a character disappearing after the ownership check', async (method) => {
  const response = await call(method);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'No such character.' });
  expect(m.update).not.toHaveBeenCalled();
  expect(m.remove).not.toHaveBeenCalled();
});
