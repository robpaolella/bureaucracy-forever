import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ user: vi.fn(), transaction: vi.fn(), lookup: vi.fn() }));
vi.mock('@/lib/armory-store', () => ({ queueLevelLookup: store.lookup }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: store.user }, $transaction: store.transaction } }));
vi.mock('@/lib/roles-sync', () => ({ refreshPostedRaidsFor: vi.fn() }));
import { PUT } from './route';

const discordId = '100000000000000001';
const input = { firstName: 'Red', secondName: 'Tape', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged' };

function call(body: object) {
  const request = new Request('https://example.test/api/bot/members/member/main', {
    method: 'PUT',
    headers: { authorization: 'Bearer test-secret' },
    body: JSON.stringify(body),
  });
  return PUT(request, { params: Promise.resolve({ discordId }) });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('BOT_SHARED_SECRET', 'test-secret');
  store.user.mockResolvedValue({ id: 'member', rank: 'RAIDER' });
  store.transaction.mockResolvedValue({ taken: false, main: { name: 'Red Tape', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' }, roleChanged: false });
});

describe('PUT /api/bot/members/:discordId/main', () => {
  it('sets a main with both names', async () => {
    const response = await call(input);
    expect(response.status).toBe(200);
    expect(store.transaction).toHaveBeenCalledTimes(1);
  });

  it.each([{ secondName: '' }, { secondName: '   ' }, { secondName: undefined }])('refuses a blank second name (%o) without writing', async (patch) => {
    const response = await call({ ...input, ...patch });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.stringMatching(/first and a second name/) });
    expect(store.transaction).not.toHaveBeenCalled();
  });

  describe('member.classes.sync', () => {
    const mage = { name: 'Red Tape', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' };
    const tx = {
      user: { findUniqueOrThrow: vi.fn() }, outboxJob: { create: vi.fn() },
      character: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    };
    const queued = () => tx.outboxJob.create.mock.calls.map(([{ data }]) => { expect(data.type).toBe('member.classes.sync'); return data.payload; });
    beforeEach(() => {
      store.transaction.mockImplementation((run) => run(tx));
      tx.user.findUniqueOrThrow.mockResolvedValue({ discordId });
      tx.outboxJob.create.mockResolvedValue({ id: 'job' });
      tx.character.findUnique.mockResolvedValue(null);
      tx.character.create.mockResolvedValue(mage);
    });

    it('queues the new main\'s class when it creates a main', async () => {
      tx.character.findFirst.mockResolvedValue(null);
      expect((await call(input)).status).toBe(200);
      expect(queued()).toEqual([{ discordId, classes: ['mage'], main: true }]);
      expect(tx.user.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'member' }, select: { discordId: true } });
    });

    it('queues only the new class when "Set my main" changes a Druid main to a Warrior', async () => {
      tx.character.findFirst.mockResolvedValue({ id: 'main', name: 'Red Tape', class: 'DRUID', raidRole: 'TANK' });
      tx.character.update.mockResolvedValue({ ...mage, class: 'WARRIOR', spec: 'Protection', raidRole: 'TANK' });
      const response = await call({ ...input, wowClass: 'warrior', spec: 'Protection', raidRole: 'tank' });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ main: { class: 'warrior' } });
      expect(queued()).toEqual([{ discordId, classes: ['warrior'], main: true }]);
    });

    it('queues nothing when the main keeps its class', async () => {
      tx.character.findFirst.mockResolvedValue({ id: 'main', name: 'Red Tape', class: 'MAGE', raidRole: 'MELEE' });
      tx.character.update.mockResolvedValue(mage);
      expect((await call(input)).status).toBe(200);
      expect(tx.outboxJob.create).not.toHaveBeenCalled();
    });

    it('queues nothing when another member holds the name', async () => {
      tx.character.findUnique.mockResolvedValue({ userId: 'other' });
      expect((await call(input)).status).toBe(409);
      expect(tx.character.create).not.toHaveBeenCalled();
      expect(tx.outboxJob.create).not.toHaveBeenCalled();
    });
  });

  describe('level lookups (#569)', () => {
    const tx = {
      user: { findUniqueOrThrow: vi.fn() }, outboxJob: { create: vi.fn() },
      character: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    };
    const saved = { id: 'main', name: 'Red Tape', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' };
    beforeEach(() => {
      store.transaction.mockImplementation((run) => run(tx));
      tx.user.findUniqueOrThrow.mockResolvedValue({ discordId });
      tx.outboxJob.create.mockResolvedValue({ id: 'job' });
      tx.character.findUnique.mockResolvedValue(null);
      tx.character.create.mockResolvedValue(saved);
      tx.character.update.mockResolvedValue(saved);
    });

    it('queues a lookup for a new main', async () => {
      tx.character.findFirst.mockResolvedValue(null);
      expect((await call(input)).status).toBe(200);
      expect(store.lookup).toHaveBeenCalledExactlyOnceWith('main');
    });

    it('clears the level in the rename write and queues a lookup', async () => {
      tx.character.findFirst.mockResolvedValue({ id: 'main', name: 'Old Name', class: 'MAGE', raidRole: 'RANGED' });
      expect((await call(input)).status).toBe(200);
      expect(tx.character.update.mock.calls[0][0].data).toMatchObject({ name: 'Red Tape', level: null, levelCheckedAt: null, levelAttemptedAt: null });
      expect(store.lookup).toHaveBeenCalledExactlyOnceWith('main');
    });

    it('keeps the level and queues none when the name stays (capitalisation aside)', async () => {
      tx.character.findFirst.mockResolvedValue({ id: 'main', name: 'RED tape', class: 'MAGE', raidRole: 'MELEE' });
      expect((await call({ ...input, spec: 'Fire' })).status).toBe(200);
      expect(tx.character.update.mock.calls[0][0].data).not.toHaveProperty('level');
      expect(store.lookup).not.toHaveBeenCalled();
    });

    it('queues none for a refused name', async () => {
      tx.character.findUnique.mockResolvedValue({ userId: 'other' });
      expect((await call(input)).status).toBe(409);
      expect(store.lookup).not.toHaveBeenCalled();
    });
  });
});
