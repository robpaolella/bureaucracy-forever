import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  session: vi.fn(), user: vi.fn(), existing: vi.fn(), list: vi.fn(), transaction: vi.fn(),
  txUser: vi.fn(), txUserOrThrow: vi.fn(), txFind: vi.fn(), pin: vi.fn(), find: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), count: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getSession: m.session }));
vi.mock('@/lib/db', () => ({ db: {
  user: { findUnique: m.user }, character: { findUnique: m.existing, findMany: m.list }, $transaction: m.transaction,
} }));
vi.mock('@/lib/roles-sync', () => ({ refreshPostedRaidsForCharacter: m.refresh }));
import { GET, POST } from './route';
import { PATCH, DELETE } from './[characterId]/route';
import { POST as MAKE_MAIN } from './[characterId]/main/route';

const alt = { id: 'alt', userId: 'owner', name: 'Sample Name', isMain: false, raidRole: 'TANK' };
const body = { name: 'Sample Name', wowClass: 'paladin', spec: 'Protection', role: 'tank', rank: 'officer', isMain: true, userId: 'other' };
const tx = { user: { findUnique: m.txUser, findUniqueOrThrow: m.txUserOrThrow }, signup: { updateMany: m.pin }, character: {
  findUnique: m.txFind, findFirst: m.find, create: m.create, update: m.update, delete: m.remove, count: m.count,
} };
const main = { ...alt, id: 'main', name: 'Main Name', isMain: true, joinedAt: new Date('2020-01-01'), attendance: 90 };
const params = { params: Promise.resolve({ characterId: 'alt' }) };
function call(method: string, data: unknown = body) {
  const request = new Request('http://localhost/api/me/characters/alt', {
    method: method === 'MAIN' ? 'POST' : method, ...(['POST', 'PATCH'].includes(method) ? { body: JSON.stringify(data) } : {}),
  });
  if (method === 'MAIN') return MAKE_MAIN(request, params);
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

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'MAIN'];
it.each(METHODS)('%s refuses signed-out callers before database access', async (method) => {
  m.session.mockResolvedValue(null);
  const response = await call(method);
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Log in first.' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(m.user).not.toHaveBeenCalled();
  expect(m.existing).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(METHODS)('%s refuses anyone without Guild Member or Officer before reading anything', async (method) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role: 'social' });
  const response = await call(method);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'Only guild members can change characters.' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(m.user).not.toHaveBeenCalled();
  expect(m.existing).not.toHaveBeenCalled();
  expect(m.list).not.toHaveBeenCalled();
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(['member', 'officer'])('%s with a main can list, add, edit and remove their own alts', async (role) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role });
  const rank = role === 'officer' ? 'OFFICER' : 'RAIDER';
  m.txUser.mockResolvedValue({ rank, characters: [{ isMain: true }] });
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    m.find.mockReset().mockResolvedValue(null);
    if (method === 'PATCH' || method === 'DELETE') m.find.mockResolvedValueOnce(alt);
    const response = await call(method);
    expect(response.status).toBe(method === 'POST' ? 201 : 200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(method === 'GET' ? [alt] : { id: 'alt', name: 'Sample Name' });
  }
  expect(m.user).toHaveBeenCalledWith({ where: { discordId: 'discord-owner' }, select: { id: true } });
  expect(m.list).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'owner' } }));
  // Neither supplied userId, isMain nor rank is writable, including by officers here.
  expect(m.create).toHaveBeenCalledWith({ data: { name: 'Sample Name', class: 'PALADIN', spec: 'Protection', raidRole: 'TANK', userId: 'owner', isMain: false, rank } });
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'alt' }, data: { name: 'Sample Name', class: 'PALADIN', spec: 'Protection', raidRole: 'TANK' } });
  expect(m.find).toHaveBeenCalledWith({ where: { id: 'alt', userId: 'owner' } });
  expect(m.refresh).toHaveBeenCalledWith(alt, tx);
});
it.each(['PATCH', 'DELETE', 'MAIN'])('%s refuses another owner\'s character and unknown ids without changing anything', async (method) => {
  for (const [existing, status, message] of [
    [{ userId: 'other' }, 403, 'You can only change your own characters.'], [null, 404, 'No such character.'],
  ] as const) {
    m.existing.mockResolvedValue(existing);
    const response = await call(method);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(m.existing).toHaveBeenCalledWith({ where: { id: 'alt' }, select: { userId: true } });
  expect(m.transaction).not.toHaveBeenCalled();
});
it.each(['member', 'officer'])('%s edits their main\'s name, class, spec and raid role, never its rank', async (role) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role });
  m.existing.mockResolvedValue(main);
  m.find.mockResolvedValueOnce(main).mockResolvedValueOnce(null);
  m.update.mockResolvedValue({ ...main, name: 'Fresh Name', raidRole: 'HEALER' });
  const response = await call('PATCH', { ...body, name: 'Fresh Name', spec: 'Holy', role: 'healer' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'main', name: 'Fresh Name' });
  expect(m.update).toHaveBeenCalledWith({ where: { id: 'alt' }, data: { name: 'Fresh Name', class: 'PALADIN', spec: 'Holy', raidRole: 'HEALER' } });
  // A raid-role change refreshes posted raids, as for alts.
  expect(m.refresh).toHaveBeenCalledWith(main, tx);
});
it('gives a taken name on a main edit the right message for own and other characters', async () => {
  m.existing.mockResolvedValue(main);
  for (const [named, message] of [
    [{ ...alt, name: 'SAMPLE NAME' }, 'You already have a character with that name.'],
    [{ ...alt, name: 'sample name', userId: 'other' }, 'That name is taken by another member.'],
  ] as const) {
    m.find.mockReset().mockResolvedValueOnce(main).mockResolvedValueOnce(named);
    const response = await call('PATCH');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: message });
    expect(m.find).toHaveBeenLastCalledWith({ where: { id: { not: 'alt' }, name: { equals: 'Sample Name', mode: 'insensitive' } } });
  }
  expect(m.update).not.toHaveBeenCalled();
});
it.each(['member', 'officer'])('%s makes their own alt the main', async (role) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role });
  m.txFind.mockResolvedValue(alt);
  m.txUserOrThrow.mockResolvedValue({ rank: 'RAIDER' });
  m.find.mockResolvedValue(main);
  m.update.mockResolvedValueOnce({ ...main, isMain: false }).mockResolvedValueOnce({ ...alt, isMain: true });
  const response = await call('MAIN');
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await response.json()).toEqual({ id: 'alt', name: 'Sample Name' });
  expect(m.pin).toHaveBeenCalledWith({ where: { userId: 'owner', characterId: null }, data: { characterId: 'main' } });
  expect(m.update).toHaveBeenNthCalledWith(1, { where: { id: 'main' }, data: { isMain: false } });
  expect(m.update).toHaveBeenNthCalledWith(2, { where: { id: 'alt' }, data: { isMain: true, rank: 'RAIDER', joinedAt: main.joinedAt, attendance: 90 } });
});
it('making the current main the main again is a 200 no-op', async () => {
  m.existing.mockResolvedValue(main);
  m.txFind.mockResolvedValue(main);
  const response = await call('MAIN');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'main', name: 'Main Name' });
  expect(m.pin).not.toHaveBeenCalled();
  expect(m.update).not.toHaveBeenCalled();
});
it('make main reports a character removed after the ownership check', async () => {
  m.txFind.mockResolvedValue(null);
  const response = await call('MAIN');
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'No such character.' });
  expect(m.update).not.toHaveBeenCalled();
});
it.each([0, 2])('refuses removing your own main with %i other characters, inside the transaction', async (others) => {
  m.find.mockResolvedValueOnce(main);
  m.count.mockResolvedValue(others);
  const response = await call('DELETE');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Make another character your main before removing this one.' });
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(m.find).toHaveBeenCalledWith({ where: { id: 'alt', userId: 'owner' } });
  expect(m.remove).not.toHaveBeenCalled();
  expect(m.refresh).not.toHaveBeenCalled();
});
it.each(['member', 'officer'])('%s adds a main when they have none, with their rank', async (role) => {
  m.session.mockResolvedValue({ discordId: 'discord-owner', role });
  m.txUser.mockResolvedValue({ rank: 'TRIAL', characters: [] });
  m.create.mockResolvedValue(main);
  const response = await call('POST', { ...body, main: true });
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: 'main', name: 'Main Name' });
  expect(m.create).toHaveBeenCalledWith({ data: { name: 'Sample Name', class: 'PALADIN', spec: 'Protection', raidRole: 'TANK', userId: 'owner', isMain: true, rank: 'TRIAL' } });
});
it('add main answers a retry with 200, another main with 409 and name clashes with their messages', async () => {
  m.txUser.mockResolvedValue({ rank: 'RAIDER', characters: [{ ...main, name: 'SAMPLE NAME' }] });
  let response = await call('POST', { ...body, main: true });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'main', name: 'SAMPLE NAME' });
  m.txUser.mockResolvedValue({ rank: 'RAIDER', characters: [main] });
  response = await call('POST', { ...body, main: true });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'You already have a main.' });
  m.txUser.mockResolvedValue({ rank: 'RAIDER', characters: [] });
  for (const [named, message] of [
    [{ ...alt, isMain: false }, 'You already have a character with that name.'],
    [{ ...alt, userId: 'other' }, 'That name is taken by another member.'],
  ] as const) {
    m.find.mockResolvedValue(named);
    response = await call('POST', { ...body, main: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: message });
  }
  expect(m.find).toHaveBeenCalledWith({ where: { name: { equals: 'Sample Name', mode: 'insensitive' } } });
  expect(m.create).not.toHaveBeenCalled();
});
it('refuses the ninth character without creating one', async () => {
  m.txUser.mockResolvedValue({ rank: 'RAIDER', characters: Array(8).fill({ isMain: true }) });
  const response = await call('POST');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'You can have up to 8 characters.' });
  expect(m.create).not.toHaveBeenCalled();
});
it.each(['member', 'officer'])('%s without a main gets the member-facing message', async (role) => {
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
  const withMain = await call('POST', { ...body, main: true });
  expect(withMain.status).toBe(409);
  expect(await withMain.json()).toEqual({ error: 'Set your main first.' });
  for (const method of ['PATCH', 'DELETE', 'MAIN']) expect((await call(method)).status).toBe(403);
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
