import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(),
  remove: vi.fn(), count: vi.fn(), user: vi.fn(), transaction: vi.fn(), rank: vi.fn(), refresh: vi.fn(),
}));
vi.mock('@/lib/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/db', () => ({ db: {
  character: { findUnique: mocks.findUnique }, $transaction: mocks.transaction,
} }));
vi.mock('@/lib/roles-sync', () => ({ setRankFromWeb: mocks.rank, refreshPostedRaidsForCharacter: mocks.refresh }));
import { POST } from './route';
import { PATCH, DELETE } from './[characterId]/route';
import { OFFICER_RANK_ERROR } from '@/content/roster-editor';

const body = { userId: 'member', name: 'Sample', wowClass: 'paladin', spec: 'Protection', role: 'tank', rank: 'raider' };
const character = { id: 'character', userId: 'member', name: 'Sample', isMain: false, raidRole: 'TANK', rank: 'RAIDER' };
const tx = { user: { findUnique: mocks.user }, character: {
  findFirst: mocks.findFirst, create: mocks.create, update: mocks.update, delete: mocks.remove, count: mocks.count,
} };
const request = (method: string, data: unknown = body) => new Request('http://localhost/api/roster/character', { method, ...(method === 'DELETE' ? {} : { body: JSON.stringify(data) }) });
const params = { params: Promise.resolve({ characterId: 'character' }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: 'officer' });
  mocks.transaction.mockImplementation((run) => run(tx));
  mocks.findUnique.mockResolvedValue({ ...character, user: { rank: 'RAIDER' } });
  mocks.user.mockResolvedValue({ id: 'member', rank: 'RAIDER', characters: [{ ...character, isMain: true }] });
  mocks.findFirst.mockResolvedValue(null);
  mocks.create.mockResolvedValue(character);
  mocks.update.mockResolvedValue(character);
  mocks.remove.mockResolvedValue(character);
  mocks.count.mockResolvedValue(0);
});

it.each(['POST', 'PATCH', 'DELETE'])('%s rejects signed-out and non-officer callers without database access', async (method) => {
  for (const [session, status] of [[null, 401], [{ role: 'member' }, 403], [{ role: 'guest' }, 403]] as const) {
    mocks.session.mockResolvedValue(session);
    const response = await (method === 'POST' ? POST(request(method)) : method === 'PATCH' ? PATCH(request(method), params) : DELETE(request(method), params));
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  }
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
it('adds an alt using the member rank, ignoring the supplied officer rank; retries return 200', async () => {
  const response = await POST(request('POST', { ...body, alt: true, rank: 'officer' }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(character);
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'member', isMain: false, rank: 'RAIDER' }) });
  expect(mocks.rank).not.toHaveBeenCalled();
  mocks.findFirst.mockResolvedValue(character);
  expect((await POST(request('POST', { ...body, alt: true }))).status).toBe(200);
});
it('refuses a ninth character with the shared message', async () => {
  mocks.user.mockResolvedValue({ rank: 'RAIDER', characters: Array(8).fill({ isMain: true }) });
  const response = await POST(request('POST', { ...body, alt: true }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'You can have up to 8 characters.' });
  expect(mocks.create).not.toHaveBeenCalled();
});
it('uses case-insensitive name checks and the shared collision message', async () => {
  mocks.findFirst.mockResolvedValue({ ...character, userId: 'other', name: 'SAMPLE' });
  const response = await POST(request('POST', { ...body, alt: true }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'That name is taken by another member.' });
  expect(mocks.findFirst).toHaveBeenCalledWith({ where: { name: { equals: 'Sample', mode: 'insensitive' } } });
});
it('keeps create-main success, existing-main rejection and officer-rank rejection', async () => {
  mocks.user.mockResolvedValue({ id: 'member', characters: [] });
  mocks.create.mockResolvedValue({ id: 'character', name: 'Sample' });
  const response = await POST(request('POST'));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ id: 'character', name: 'Sample' });
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isMain: true }) }));
  expect(mocks.rank).toHaveBeenCalledWith('member', 'RAIDER');
  mocks.user.mockResolvedValue({ id: 'member', characters: [character] });
  expect((await POST(request('POST'))).status).toBe(409);
  mocks.transaction.mockClear();
  const denied = await POST(request('POST', { ...body, rank: 'officer' }));
  expect(denied.status).toBe(400);
  expect(await denied.json()).toEqual({ error: OFFICER_RANK_ERROR });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it('edits an alt, ignoring rank, and queues a refresh through the shared rules', async () => {
  mocks.findFirst.mockResolvedValueOnce(character).mockResolvedValueOnce(null);
  mocks.update.mockResolvedValue({ ...character, raidRole: 'HEALER' });
  const response = await PATCH(request('PATCH', { ...body, spec: 'Holy', role: 'healer', rank: 'invalid' }), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'character', name: 'Sample' });
  expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: 'character', userId: 'member' } });
  expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'character' }, data: { name: 'Sample', class: 'PALADIN', spec: 'Holy', raidRole: 'HEALER' } });
  expect(mocks.refresh).toHaveBeenCalledWith(character, tx);
  expect(mocks.rank).not.toHaveBeenCalled();
});
it.each([['RAIDER', 'officer'], ['OFFICER', 'raider']])('rejects main rank change %s to %s before writing', async (current, rank) => {
  mocks.findUnique.mockResolvedValue({ ...character, isMain: true, user: { rank: current } });
  const response = await PATCH(request('PATCH', { ...body, rank }), params);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: OFFICER_RANK_ERROR });
  expect(mocks.transaction).not.toHaveBeenCalled();
  expect(mocks.rank).not.toHaveBeenCalled();
});
it('updates main rank after a successful edit, never after a failed edit', async () => {
  mocks.findUnique.mockResolvedValue({ ...character, isMain: true, user: { rank: 'RAIDER' } });
  mocks.findFirst.mockResolvedValueOnce({ ...character, isMain: true }).mockResolvedValueOnce(null);
  expect((await PATCH(request('PATCH', { ...body, rank: 'trial' }), params)).status).toBe(200);
  expect(mocks.rank).toHaveBeenCalledWith('member', 'TRIAL');
  mocks.rank.mockClear();
  mocks.findFirst.mockResolvedValueOnce(character).mockResolvedValueOnce({ ...character, userId: 'other' });
  const response = await PATCH(request('PATCH'), params);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'That name is taken by another member.' });
  expect(mocks.rank).not.toHaveBeenCalled();
});
it.each([false, true])('removes a character with no remaining alts (main: %s)', async (isMain) => {
  mocks.findFirst.mockResolvedValue({ ...character, isMain });
  const response = await DELETE(request('DELETE'), params);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ id: 'character', name: 'Sample' });
  expect(mocks.refresh).toHaveBeenCalledWith({ ...character, isMain }, tx);
  expect(mocks.remove).toHaveBeenCalledWith({ where: { id: 'character' } });
  expect(mocks.rank).not.toHaveBeenCalled();
});
it('refuses to remove a main with alts', async () => {
  mocks.findFirst.mockResolvedValue({ ...character, isMain: true });
  mocks.count.mockResolvedValue(1);
  const response = await DELETE(request('DELETE'), params);
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Make another character the main first.' });
  expect(mocks.remove).not.toHaveBeenCalled();
});
it.each(['PATCH', 'DELETE'])('%s returns 404 for an unknown id before editing', async (method) => {
  mocks.findUnique.mockResolvedValue(null);
  const response = await (method === 'PATCH' ? PATCH(request(method, null), params) : DELETE(request(method), params));
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: 'No such character.' });
  expect(mocks.transaction).not.toHaveBeenCalled();
});
