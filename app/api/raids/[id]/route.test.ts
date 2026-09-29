import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@/lib/generated/prisma/client';

const mocks = vi.hoisted(() => ({
  session: null as { role: string } | null,
  findUnique: vi.fn(),
  lootCount: vi.fn(),
  deleteRaid: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock('@/lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('@/lib/outbox', () => ({ enqueue: mocks.enqueue }));
vi.mock('@/lib/db', () => {
  const tx = { raidSeries: { findUnique: vi.fn(), update: vi.fn() }, outboxJob: { updateMany: vi.fn() }, raid: { delete: mocks.deleteRaid } };
  return {
    db: {
      raid: { findUnique: mocks.findUnique },
      lootAward: { count: mocks.lootCount },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    },
  };
});

import { DELETE } from './route';

const call = () => DELETE(new Request('https://example.test/api/raids/r1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'r1' }) });
const RAID = { id: 'r1', name: 'Molten Core', startsAt: new Date('2026-10-16T03:00:00.000Z'), seriesId: null, discordThreadId: null, discordMessageId: null };

describe('DELETE /api/raids/[id]', () => {
  beforeEach(() => {
    mocks.session = { role: 'officer' };
    mocks.findUnique.mockReset().mockResolvedValue(RAID);
    mocks.lootCount.mockReset().mockResolvedValue(0);
    mocks.deleteRaid.mockReset().mockResolvedValue(RAID);
    mocks.enqueue.mockReset();
  });

  it('deletes a raid with no loot recorded', async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'r1', name: 'Molten Core', deleted: true });
    expect(mocks.deleteRaid).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('refuses a raid that has loot recorded', async () => {
    mocks.lootCount.mockResolvedValue(2);
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'This raid has loot recorded. Cancel it instead.' });
    expect(mocks.deleteRaid).not.toHaveBeenCalled();
  });

  it('answers 409 when loot lands between the check and the delete', async () => {
    mocks.deleteRaid.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Foreign key constraint violated', { code: 'P2003', clientVersion: 'test' }));
    const res = await call();
    expect(res.status).toBe(409);
  });

  it('is for officers only', async () => {
    mocks.session = { role: 'member' };
    expect((await call()).status).toBe(403);
    expect(mocks.deleteRaid).not.toHaveBeenCalled();
  });
});
