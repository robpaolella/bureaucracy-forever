import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({
  session: null as { role: string; discordId: string } | null,
  loot: true,
  raid: vi.fn(),
  user: vi.fn(),
  signup: vi.fn(),
  items: vi.fn(),
  awards: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  transaction: vi.fn(),
  query: vi.fn(),
  settings: vi.fn(),
  existing: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer-user' }) }));
vi.mock('@/lib/loot-data', async () => {
  const real = await vi.importActual<typeof import('@/lib/loot-data')>('@/lib/loot-data');
  return { signupAnswer: real.signupAnswer, tableItemIds: mocks.items, hrAwardsFor: mocks.awards };
});
vi.mock('@/lib/db', () => ({
  db: {
    raid: { findUnique: mocks.raid },
    user: { findUnique: mocks.user },
    signup: { findUnique: mocks.signup },
    reserve: { deleteMany: mocks.deleteMany, createMany: mocks.createMany, findMany: mocks.existing },
    lootReserveSetting: { findMany: mocks.settings },
    $queryRaw: mocks.query,
    $transaction: mocks.transaction,
  },
}));

import { PUT } from './route';

const HOUR = 3600_000;
const call = (body: unknown) => PUT(new Request('https://example.test', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'r1' }) });
const BODY = { characterId: 'c1', hr: 100, sr: 200 };

beforeEach(() => {
  mocks.session = { role: 'member', discordId: 'd1' };
  mocks.loot = true;
  for (const m of [mocks.raid, mocks.user, mocks.signup, mocks.items, mocks.awards, mocks.deleteMany, mocks.createMany, mocks.transaction]) m.mockReset();
  mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + 24 * HOUR), cancelledAt: null, templateId: 't1' });
  mocks.user.mockResolvedValue({ id: 'u1', characters: [{ id: 'c1' }, { id: 'c2' }] });
  mocks.signup.mockResolvedValue({ response: 'ACCEPT' });
  mocks.items.mockResolvedValue(new Set([100, 200, 300]));
  mocks.awards.mockResolvedValue([]);
  mocks.deleteMany.mockReturnValue('delete');
  mocks.createMany.mockImplementation((args) => args);
  mocks.query.mockReset().mockResolvedValue([{ id: 't1' }]);
  mocks.settings.mockReset().mockResolvedValue([]);
  mocks.existing.mockReset().mockResolvedValue([]);
  mocks.transaction.mockImplementation(async (run) => run((await import('@/lib/db')).db));
});

describe('PUT /api/raids/[id]/reserves', () => {
  it('replaces the member’s reserves with the new pair', async () => {
    const res = await call(BODY);
    expect(res.status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { raidId: 'r1', userId: 'u1' } });
    expect(mocks.createMany.mock.calls[0][0].data).toEqual([
      { kind: 'HR', itemId: 100, raidId: 'r1', userId: 'u1', characterId: 'c1', setById: null },
      { kind: 'SR', itemId: 200, raidId: 'r1', userId: 'u1', characterId: 'c1', setById: null },
    ]);
  });

  it.each([
    ['member', false], ['officer', false], ['officer', true],
  ] as const)('refuses previously won HR and SR for %s (locked: %s), including kept reserves', async (role, locked) => {
    mocks.session = { role, discordId: 'd1' };
    if (locked) mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + HOUR), cancelledAt: null, templateId: 't1' });
    const forUserId = role === 'officer' ? 'u1' : undefined;
    // Save first, then win: the stored reserve must survive a refused re-save.
    expect((await call({ ...BODY, forUserId })).status).toBe(200);
    mocks.transaction.mockClear();
    mocks.deleteMany.mockClear();
    mocks.createMany.mockClear();
    mocks.awards.mockResolvedValue([{ characterId: 'c1', itemId: 100 }]);
    for (const picks of [{ hr: 100, sr: 300 }, { hr: 300, sr: 100 }]) {
      const res = await call({ characterId: 'c1', ...picks, forUserId });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'This character already won that item.' });
    }
    expect(mocks.awards).toHaveBeenCalledWith(['c1']);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect((await call({ characterId: 'c1', hr: 300, sr: 200, forUserId })).status).toBe(200);
  });

  it('clears with two nulls', async () => {
    expect((await call({ characterId: 'c1', hr: null, sr: null })).status).toBe(200);
    expect(mocks.createMany.mock.calls[0][0].data).toEqual([]);
  });

  it('is a 404 while the loot flag is off, and needs a login', async () => {
    mocks.loot = false;
    expect((await call(BODY)).status).toBe(404);
    mocks.loot = true;
    mocks.session = null;
    expect((await call(BODY)).status).toBe(401);
  });

  it.each([
    ['an absent sign-up', () => mocks.signup.mockResolvedValue({ response: 'ABSENT' }), 409, 'Sign up as Accept or Tentative to reserve.'],
    ['no sign-up', () => mocks.signup.mockResolvedValue(null), 409, 'Sign up as Accept or Tentative to reserve.'],
    ['a cancelled raid', () => mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + 24 * HOUR), cancelledAt: new Date(), templateId: 't1' }), 409, 'This raid was cancelled.'],
    ['a locked raid', () => mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + HOUR), cancelledAt: null, templateId: 't1' }), 409, 'Reserves are locked. Ask an officer to change them.'],
    ['a raid without a table', () => mocks.items.mockResolvedValue(new Set()), 409, 'This raid has no loot table yet.'],
    ['an HR already won', () => mocks.awards.mockResolvedValue([{ characterId: 'c1', itemId: 100 }]), 409, 'This character already won that item.'],
  ])('refuses %s', async (_label, arrange, status, error) => {
    arrange();
    const res = await call(BODY);
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it('lets a member who is no longer eligible clear, but not set', async () => {
    mocks.signup.mockResolvedValue({ response: 'ABSENT' });
    expect((await call({ characterId: 'c1', hr: null, sr: null })).status).toBe(200);
  });

  it('locks a member out from exactly two hours before the start', async () => {
    mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + 2 * HOUR - 1000), cancelledAt: null, templateId: 't1' });
    expect((await call(BODY)).status).toBe(409);
    mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + 2 * HOUR + 60_000), cancelledAt: null, templateId: 't1' });
    expect((await call(BODY)).status).toBe(200);
  });

  it('refuses an item outside the table and a raid without a template', async () => {
    expect(await (await call({ ...BODY, sr: 999 })).json()).toEqual({ error: "That item isn't in this raid's loot table." });
    mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + 24 * HOUR), cancelledAt: null, templateId: null });
    expect(await (await call(BODY)).json()).toEqual({ error: 'This raid has no loot table yet.' });
  });

  it('refuses the same item twice, a character that is not theirs and a bad body', async () => {
    expect((await call({ ...BODY, sr: 100 })).status).toBe(409);
    expect((await call({ ...BODY, characterId: 'someone-else' })).status).toBe(403);
    expect((await call({ characterId: 'c1', hr: 'sword', sr: null })).status).toBe(400);
  });

  it('lets only officers set someone else’s, and past the lock', async () => {
    expect((await call({ ...BODY, forUserId: 'u2' })).status).toBe(403);
    mocks.session = { role: 'officer', discordId: 'd9' };
    mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() + HOUR), cancelledAt: null, templateId: 't1' });
    expect((await call({ ...BODY, forUserId: 'u2' })).status).toBe(200);
    expect(mocks.user).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'u2' } }));
    expect(mocks.createMany.mock.calls[0][0].data[0]).toMatchObject({ setById: 'officer-user' });
  });

  it.each(['member', 'officer'] as const)('preserves the stored blocked row when %s edits the other slot', async (role) => {
    mocks.session = { role, discordId: 'd1' };
    if (role === 'officer') mocks.raid.mockResolvedValue({ startsAt: new Date(Date.now() - HOUR), cancelledAt: null, templateId: 't1' });
    mocks.settings.mockResolvedValue([{ itemId: 100 }]);
    mocks.existing.mockResolvedValue([{ id: 'kept', characterId: 'c1', kind: 'HR', itemId: 100 }]);
    expect((await call({ ...BODY, sr: 300 })).status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { raidId: 'r1', userId: 'u1', id: { notIn: ['kept'] } } });
    expect(mocks.createMany).toHaveBeenCalledWith({ data: [{ kind: 'SR', itemId: 300, raidId: 'r1', userId: 'u1', characterId: 'c1', setById: null }] });
  });

  it('rechecks after waiting for a block transaction, rather than trusting the earlier table read', async () => {
    let release!: () => void;
    let arrived!: () => void;
    const waiting = new Promise<void>((resolve) => { arrived = resolve; });
    const lock = new Promise<void>((resolve) => { release = resolve; });
    mocks.query.mockImplementation(async () => { arrived(); await lock; return [{ id: 't1' }]; });
    const saving = call(BODY);
    await waiting;
    expect(mocks.items).toHaveBeenCalled();
    expect(mocks.settings).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    // The block commits while the save waits for the tier lock.
    mocks.settings.mockResolvedValue([{ itemId: 100 }]);
    release();
    const response = await saving;
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Not open to reserves' });
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.createMany).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
  });

  it('answers 409 when the database unique index catches a race', async () => {
    mocks.transaction.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));
    expect((await call(BODY)).status).toBe(409);
  });
});
