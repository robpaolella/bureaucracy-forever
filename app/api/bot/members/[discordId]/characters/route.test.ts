import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ user: vi.fn(), character: vi.fn(), add: vi.fn(), remove: vi.fn(), keys: new Map<string, object>() }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: store.user }, character: { findUnique: store.character }, botRequest: {
  findUnique: async ({ where }: { where: { key: string } }) => store.keys.get(where.key) ?? null,
  create: async ({ data }: { data: { key: string } }) => {
    if (store.keys.has(data.key)) throw new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' });
    store.keys.set(data.key, data);
  },
  updateMany: async ({ where, data }: { where: { key: string }; data: object }) => { store.keys.set(where.key, { ...store.keys.get(where.key)!, ...data }); return { count: 1 }; },
  deleteMany: async ({ where }: { where: { key: string } }) => ({ count: Number(store.keys.delete(where.key)) }),
} } }));
vi.mock('@/lib/characters', () => ({ addAlt: store.add, removeCharacter: store.remove }));
import { Prisma } from '@/lib/generated/prisma/client';
import { GET } from '../route';
import { POST } from './route';
import { DELETE } from './[characterId]/route';

const discordId = '100000000000000001';
const alt = { id: 'alt', userId: 'member', name: 'Alt Name', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED', isMain: false };
const main = { ...alt, id: 'main', name: 'Main Name', isMain: true };
const wireAlt = { id: 'alt', name: 'Alt Name', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged', isMain: false };
const input = { name: 'Alt Name', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged' };
function call(method: 'GET' | 'POST' | 'DELETE', options: { id?: string; secret?: string; body?: string; key?: string } = {}) {
  const request = new Request('https://example.test/api/bot/members/member/characters', {
    method, headers: { authorization: `Bearer ${options.secret ?? 'test-secret'}`, ...(options.key ? { 'Idempotency-Key': options.key } : {}) },
    ...(method === 'POST' ? { body: options.body ?? JSON.stringify(input) } : {}),
  });
  const params = Promise.resolve({ discordId: options.id ?? discordId, characterId: 'alt' });
  return ({ GET, POST, DELETE })[method](request, { params });
}

beforeEach(() => {
  vi.resetAllMocks();
  store.keys.clear();
  vi.stubEnv('BOT_SHARED_SECRET', 'test-secret');
  store.user.mockResolvedValue({ id: 'member', discordName: 'Sample', role: 'MEMBER', rank: 'RAIDER', inGuild: true, characters: [main, alt] });
  store.character.mockResolvedValue(alt);
  store.add.mockResolvedValue({ status: 201, character: alt });
  store.remove.mockResolvedValue({ status: 200, character: alt });
});

describe('member characters bot API', () => {
  it.each(['GET', 'POST', 'DELETE'] as const)('%s rejects bad secrets, invalid ids and unknown members', async (method) => {
    expect((await call(method, { secret: 'wrong' })).status).toBe(401);
    expect(store.user).not.toHaveBeenCalled();
    expect((await call(method, { id: 'bad' })).status).toBe(400);
    store.user.mockResolvedValue(null);
    expect((await call(method)).status).toBe(404);
    expect(store.add).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('GET preserves existing fields and includes main-first characters', async () => {
    const response = await call('GET');
    expect(await response.json()).toEqual({ discordId, discordName: 'Sample', role: 'member', rank: 'raider', inGuild: true,
      main: { name: 'Main Name', class: 'mage', spec: 'Frost', raidRole: 'ranged' },
      characters: [{ ...wireAlt, id: 'main', name: 'Main Name', isMain: true }, wireAlt] });
    expect(store.user.mock.calls[0][0].select.characters.orderBy).toEqual([{ isMain: 'desc' }, { name: 'asc' }]);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('GET does not mistake an alt for the main and handles no characters', async () => {
    for (const characters of [[alt], []]) {
      store.user.mockResolvedValue({ role: 'MEMBER', rank: 'SOCIAL', characters });
      const body = await (await call('GET')).json();
      expect(body.main).toBeNull();
      expect(body.characters).toHaveLength(characters.length);
    }
  });

  it('POST maps raidRole, adds an alt, and returns the existing id on a repeated add', async () => {
    const first = await call('POST');
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ character: wireAlt });
    expect(store.add).toHaveBeenCalledWith('member', { ...input, role: 'ranged' });
    store.add.mockResolvedValue({ status: 200, character: alt });
    const repeat = await call('POST');
    expect(repeat.status).toBe(200);
    expect(await repeat.json()).toEqual({ character: wireAlt });
  });

  it.each(['name_taken', 'limit', 'no_main', 'busy', 'invalid'])('POST preserves the %s failure', async (reason) => {
    const status = reason === 'invalid' ? 400 : 409;
    store.add.mockResolvedValue({ status, reason, error: 'Explanation.' });
    const response = await call('POST');
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ reason, error: 'Explanation.' });
  });

  it('POST refuses a one-part name through the real validation without writing', async () => {
    const real = await vi.importActual<typeof import('@/lib/characters')>('@/lib/characters');
    store.add.mockImplementation(real.addAlt);
    const response = await call('POST', { body: JSON.stringify({ ...input, name: 'Alt' }) });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ reason: 'invalid', error: expect.stringMatching(/first and a second name/) });
  });

  it('POST rejects malformed JSON without writing', async () => {
    expect((await call('POST', { body: '{' })).status).toBe(400);
    expect(store.add).not.toHaveBeenCalled();
  });

  it('DELETE removes only an alt and repeats as bodyless 204', async () => {
    const first = await call('DELETE');
    expect(first.status).toBe(204);
    expect(await first.text()).toBe('');
    expect(store.remove).toHaveBeenCalledWith('member', 'alt', { altOnly: true });
    store.character.mockResolvedValue(null);
    expect((await call('DELETE')).status).toBe(204);
    expect(store.remove).toHaveBeenCalledTimes(1);
  });

  it('DELETE hides another member’s character and refuses even a lone main', async () => {
    store.character.mockResolvedValue({ ...main, userId: 'other' });
    expect((await call('DELETE')).status).toBe(404);
    store.character.mockResolvedValue(main);
    const response = await call('DELETE');
    expect(response.status).toBe(409);
    expect((await response.json()).reason).toBe('main');
    expect(store.remove).not.toHaveBeenCalled();
  });

  it.each([['not_found', 404, 204], ['main', 409, 409], ['busy', 409, 409]] as const)('DELETE handles transactional %s after its read', async (reason, status, expected) => {
    store.remove.mockResolvedValue({ status, reason, error: 'Explanation.' });
    const response = await call('DELETE');
    expect(response.status).toBe(expected);
    if (expected === 204) expect(await response.text()).toBe('');
    else expect(await response.json()).toEqual({ reason, error: 'Explanation.' });
  });

  it.each(['POST', 'DELETE'] as const)('%s stores and replays the response without a second mutation', async (method) => {
    const first = await call(method, { key: 'interaction' });
    const replay = await call(method, { key: 'interaction' });
    expect(replay.status).toBe(first.status);
    expect(await replay.text()).toBe(await first.text());
    expect(replay.headers.get('Idempotent-Replay')).toBe('true');
    expect(method === 'POST' ? store.add : store.remove).toHaveBeenCalledTimes(1);
  });
});
