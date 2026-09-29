import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({ boss: vi.fn(), update: vi.fn(), findMany: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/db', () => {
  const lootBoss = { findUnique: mocks.boss, update: mocks.update, findMany: mocks.findMany, delete: mocks.del };
  return { db: { lootBoss, $transaction: (fn: (tx: { lootBoss: typeof lootBoss }) => Promise<unknown>) => fn({ lootBoss }) } };
});

import { DELETE, PATCH } from './route';

const ctx = { params: Promise.resolve({ bossId: 'b2' }) };
const patch = (body: unknown) => PATCH(new Request('https://example.test', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx);
const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.boss.mockResolvedValue({ templateId: 't1' });
  mocks.findMany.mockResolvedValue([{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }]);
});

describe('PATCH /api/loot/bosses/[bossId]', () => {
  it('moves a boss up and renumbers the tier', async () => {
    expect((await patch({ move: 'up' })).status).toBe(200);
    expect(mocks.update.mock.calls.map((c) => [c[0].where.id, c[0].data.position])).toEqual([
      ['b2', 0],
      ['b1', 1],
      ['b3', 2],
    ]);
  });

  it('renames, and answers 409 for a taken name and 404 for a gone boss', async () => {
    expect((await patch({ name: 'Ragnaros', isTrash: false })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { name: 'Ragnaros', isTrash: false } });
    mocks.update.mockRejectedValueOnce(prismaError('P2002'));
    expect((await patch({ name: 'Garr' })).status).toBe(409);
    mocks.update.mockRejectedValueOnce(prismaError('P2025'));
    expect((await patch({ name: 'Garr' })).status).toBe(404);
    mocks.boss.mockResolvedValueOnce(null);
    expect((await patch({ name: 'Garr' })).status).toBe(404);
    expect((await patch({})).status).toBe(400);
  });
});

describe('DELETE /api/loot/bosses/[bossId]', () => {
  it('deletes, and 404s when already gone', async () => {
    expect((await DELETE(new Request('https://example.test'), ctx)).status).toBe(200);
    mocks.del.mockRejectedValueOnce(prismaError('P2025'));
    expect((await DELETE(new Request('https://example.test'), ctx)).status).toBe(404);
  });
});
