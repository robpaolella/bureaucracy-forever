import { beforeEach, expect, it, vi } from 'vitest';
import type { Session } from '@/lib/session';

const mocks = vi.hoisted(() => ({
  create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ db: {
  helperKey: { create: mocks.create, findMany: mocks.findMany, findUnique: mocks.findUnique, updateMany: mocks.updateMany },
  user: { upsert: mocks.upsert },
} }));
import { createHelperKey, hashHelperKey, helperKeyName, listHelperKeys, newHelperKey, recordHelperKeyUse, revokeHelperKey, verifyHelperKey } from './helper-keys';

const session = (role: Session['role'], discordId = 'officer-a') => ({ discordId, role, name: 'Sample' }) as Session;
const created = new Date('2026-10-14T12:00:00Z');
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upsert.mockResolvedValue({ id: 'user-a' });
  mocks.create.mockImplementation(({ data }) => Promise.resolve({ id: 'key-1', name: data.name, createdAt: created, lastUsedAt: null }));
});

it('makes keys of bfh_ plus 32 random bytes in base64url', () => {
  const key = newHelperKey();
  expect(key).toMatch(/^bfh_[A-Za-z0-9_-]{43}$/);
  expect(Buffer.from(key.slice(4), 'base64url')).toHaveLength(32);
  expect(newHelperKey()).not.toBe(key);
  expect(hashHelperKey('bfh_x')).toMatch(/^[0-9a-f]{64}$/);
});

it('trims the name and refuses a blank one or one over 40 characters', () => {
  expect(helperKeyName('  Raid laptop  ')).toEqual({ ok: true, name: 'Raid laptop' });
  expect(helperKeyName('x'.repeat(40))).toEqual({ ok: true, name: 'x'.repeat(40) });
  expect(helperKeyName('é'.repeat(40))).toMatchObject({ ok: true });
  for (const blank of ['', '   ', undefined, null, 7]) expect(helperKeyName(blank)).toEqual({ ok: false, status: 400, error: 'Give the key a name.' });
  expect(helperKeyName('x'.repeat(41))).toEqual({ ok: false, status: 400, error: 'Keep the name to 40 characters or fewer.' });
});

it('creates a key, returning the plain key once and storing only its hash', async () => {
  const result = await createHelperKey(session('officer'), ' Raid laptop ');
  if (!result.ok) throw new Error('expected a key');
  expect(result).toEqual({ ok: true, key: expect.stringMatching(/^bfh_/), id: 'key-1', name: 'Raid laptop', createdAt: created, lastUsedAt: null });
  const { data } = mocks.create.mock.calls[0][0];
  expect(data).toEqual({ userId: 'user-a', name: 'Raid laptop', keyHash: hashHelperKey(result.key) });
  expect(JSON.stringify(mocks.create.mock.calls)).not.toContain(result.key);
  // A new row starts as an officer; an existing row's stored role is never touched.
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ role: 'OFFICER' }), update: {} }));
});

it('refuses a bad name before writing anything', async () => {
  expect(await createHelperKey(session('officer'), ' ')).toMatchObject({ ok: false, status: 400 });
  expect(await createHelperKey(session('officer'), 'x'.repeat(41))).toMatchObject({ ok: false, status: 400 });
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it('refuses create, list and revoke to anyone but an officer', async () => {
  for (const [who, status] of [[null, 401], [session('member'), 403], [session('social'), 403]] as const) {
    expect(await createHelperKey(who, 'Laptop')).toMatchObject({ ok: false, status });
    expect(await listHelperKeys(who)).toMatchObject({ ok: false, status });
    expect(await revokeHelperKey(who, 'key-1')).toMatchObject({ ok: false, status });
  }
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.findMany).not.toHaveBeenCalled();
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

it('lists only the caller’s live keys', async () => {
  mocks.findMany.mockResolvedValue([]);
  expect(await listHelperKeys(session('officer'))).toEqual({ ok: true, keys: [] });
  expect(mocks.findMany.mock.calls[0][0].where).toEqual({ user: { discordId: 'officer-a' }, revokedAt: null });
  expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty('keyHash');
});

it('revokes only the caller’s own live key and refuses any other', async () => {
  mocks.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  expect(await revokeHelperKey(session('officer'), 'key-1')).toEqual({ ok: true });
  expect(mocks.updateMany.mock.calls[0][0]).toEqual({ where: { id: 'key-1', user: { discordId: 'officer-a' }, revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  expect(await revokeHelperKey(session('officer'), 'someone-elses')).toMatchObject({ ok: false, status: 404 });
});

it('verifies a live key of a current officer', async () => {
  const key = newHelperKey();
  mocks.findUnique.mockResolvedValue({ id: 'key-1', revokedAt: null, user: { id: 'user-a', role: 'OFFICER' } });
  expect(await verifyHelperKey(key)).toEqual({ ok: true, userId: 'user-a', keyId: 'key-1' });
  expect(mocks.findUnique.mock.calls[0][0].where).toEqual({ keyHash: hashHelperKey(key) });
});

it('refuses missing, malformed, unknown and revoked keys with 401', async () => {
  for (const bad of [null, undefined, '', 'bfh_short', `xyz_${'a'.repeat(43)}`, `bfh_${'a'.repeat(42)}!`]) expect(await verifyHelperKey(bad)).toEqual({ ok: false, status: 401 });
  expect(mocks.findUnique).not.toHaveBeenCalled();
  mocks.findUnique.mockResolvedValueOnce(null);
  expect(await verifyHelperKey(newHelperKey())).toEqual({ ok: false, status: 401 });
  mocks.findUnique.mockResolvedValueOnce({ id: 'key-1', revokedAt: new Date(), user: { id: 'user-a', role: 'OFFICER' } });
  expect(await verifyHelperKey(newHelperKey())).toEqual({ ok: false, status: 401 });
});

it('reads the owner’s stored role on every call: 403 right after it changes', async () => {
  const key = newHelperKey();
  let role = 'OFFICER';
  mocks.findUnique.mockImplementation(() => Promise.resolve({ id: 'key-1', revokedAt: null, user: { id: 'user-a', role } }));
  expect(await verifyHelperKey(key)).toMatchObject({ ok: true });
  for (const demoted of ['MEMBER', 'SOCIAL']) {
    role = demoted;
    expect(await verifyHelperKey(key)).toEqual({ ok: false, status: 403 });
  }
  role = 'OFFICER';
  expect(await verifyHelperKey(key)).toMatchObject({ ok: true });
  expect(mocks.findUnique).toHaveBeenCalledTimes(4);
});

it('records last use on a key that is still live', async () => {
  const at = new Date('2026-10-14T13:00:00Z');
  mocks.updateMany.mockResolvedValue({ count: 1 });
  await recordHelperKeyUse('key-1', at);
  expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'key-1', revokedAt: null }, data: { lastUsedAt: at } });
});
