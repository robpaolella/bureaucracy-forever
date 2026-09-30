import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: { role: 'officer', discordId: 'd9' } as { role: string; discordId: string } | null,
  loot: true,
  raid: vi.fn(),
  items: vi.fn(),
  boss: vi.fn(),
  character: vi.fn(),
  create: vi.fn(),
  findAward: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => mocks.loot }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer-user' }) }));
vi.mock('@/lib/loot-data', () => ({ tableItemIds: mocks.items }));
vi.mock('@/lib/db', () => ({
  db: {
    raid: { findUnique: mocks.raid },
    lootBoss: { findFirst: mocks.boss },
    character: { findUnique: mocks.character },
    lootAward: { create: mocks.create, findFirst: mocks.findAward, updateMany: mocks.updateMany },
  },
}));

import { POST } from './route';
import { PATCH } from './[awardId]/route';

const req = (method: string, body: unknown) => new Request('https://example.test', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const record = (body: unknown) => POST(req('POST', body), { params: Promise.resolve({ id: 'r1' }) });
const voidIt = (body: unknown) => PATCH(req('PATCH', body), { params: Promise.resolve({ id: 'r1', awardId: 'a1' }) });
const WIN = { bossId: 'b1', itemId: 100, characterId: 'c1', method: 'HR', roll: 87, note: '' };

beforeEach(() => {
  mocks.session = { role: 'officer', discordId: 'd9' };
  mocks.loot = true;
  for (const m of [mocks.raid, mocks.items, mocks.boss, mocks.character, mocks.create, mocks.findAward, mocks.updateMany]) m.mockReset();
  mocks.raid.mockResolvedValue({ cancelledAt: null, templateId: 't1' });
  mocks.items.mockResolvedValue(new Set([100]));
  mocks.boss.mockResolvedValue({ name: 'Ragnaros' });
  mocks.character.mockResolvedValue({ name: 'Addendum', userId: 'u2' });
  mocks.create.mockResolvedValue({ id: 'a1' });
  mocks.findAward.mockResolvedValue({ voidedAt: null });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe('POST /api/raids/[id]/loot', () => {
  it('records a win with the names copied and the officer as recorder', async () => {
    const res = await record(WIN);
    expect(res.status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toEqual({ raidId: 'r1', bossId: 'b1', bossName: 'Ragnaros', itemId: 100, characterId: 'c1', characterName: 'Addendum', userId: 'u2', method: 'HR', roll: 87, note: null, recordedById: 'officer-user' });
  });

  it('records disenchant/bank with no character', async () => {
    expect((await record({ itemId: 100, method: 'DISENCHANT_BANK' })).status).toBe(201);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ characterId: null, characterName: null, userId: null, bossId: null });
  });

  it('is officer-only and 404s with the flag off', async () => {
    mocks.session = { role: 'member', discordId: 'd1' };
    expect((await record(WIN)).status).toBe(403);
    mocks.loot = false;
    expect((await record(WIN)).status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('refuses cancelled raids, items outside the table, foreign bosses and unknown characters', async () => {
    mocks.raid.mockResolvedValueOnce({ cancelledAt: new Date(), templateId: 't1' });
    expect((await record(WIN)).status).toBe(409);
    expect((await record({ ...WIN, itemId: 999 })).status).toBe(409);
    mocks.boss.mockResolvedValueOnce(null);
    expect((await record(WIN)).status).toBe(400);
    mocks.character.mockResolvedValueOnce(null);
    expect((await record(WIN)).status).toBe(404);
    expect((await record({ ...WIN, roll: 500 })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/raids/[id]/loot/[awardId]', () => {
  it('voids once, keeping the record', async () => {
    expect((await voidIt({ reason: ' wrong person ' })).status).toBe(200);
    expect(mocks.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'a1', voidedAt: null }, data: { voidedById: 'officer-user', voidReason: 'wrong person' } });
    mocks.findAward.mockResolvedValue({ voidedAt: new Date() });
    expect((await voidIt({})).status).toBe(409);
  });

  it('answers 409 when another officer voided it first, 404 for another raid’s record', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await voidIt({})).status).toBe(409);
    mocks.findAward.mockResolvedValue(null);
    expect((await voidIt({})).status).toBe(404);
  });
});
