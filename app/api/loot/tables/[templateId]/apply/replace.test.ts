import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real apply behind the route, on a stand-in transaction: what the request asks can't widen what replace removes.
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(), $executeRaw: vi.fn(), raidTemplate: { findUnique: vi.fn() }, lootItem: { findMany: vi.fn() },
  lootBoss: { create: vi.fn(), delete: vi.fn() }, lootTableEntry: { createMany: vi.fn(), deleteMany: vi.fn() }, lootTableLoad: { create: vi.fn() },
  reserve: { findMany: vi.fn() }, lootAward: { findMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ db: { $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx) } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer', discordId: 'discord-officer', name: 'Sample Officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer' }) }));
import { tableStateToken, type LoadTableState } from '@/lib/loot-load';
import { POST } from './route';

const state: LoadTableState = {
  id: 'tier',
  lootBosses: [{ id: 'rag', name: 'Ragnaros', position: 0, isTrash: false, entries: [{ itemId: 7, position: 0 }, { itemId: 8, position: 1 }] }],
  reserveSettings: [],
};
const protection = { reserves: [], awards: [7] };
const call = (input: unknown) => POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify(input) }), { params: Promise.resolve({ templateId: 'tier' }) });

describe('loot-table apply route in replace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.raidTemplate.findUnique.mockResolvedValue(structuredClone(state));
    tx.lootItem.findMany.mockResolvedValue([]);
    tx.reserve.findMany.mockResolvedValue([]);
    tx.lootAward.findMany.mockResolvedValue([{ itemId: 7 }]);
    tx.lootBoss.create.mockResolvedValue({ id: 'new' });
  });

  it('cannot remove a protected item, or its boss, even if the request asks for it', async () => {
    const response = await call({
      file: { bosses: [{ name: 'Other', items: [] }] }, sourceName: 'small.json', replace: true, token: tableStateToken(state, protection),
      // None of these exist in the contract; protection is recomputed under the lock.
      remove: [7], kept: [], absent: 'remove', protection: { reserves: [], awards: [] },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ added: 0, newBosses: 1, removed: 1 });
    expect(tx.lootTableEntry.deleteMany.mock.calls).toEqual([[{ where: { bossId: 'rag', itemId: { in: [8] } } }]]);
    expect(tx.lootBoss.delete).not.toHaveBeenCalled();
  });

  it('refuses a token made without the protected item', async () => {
    const response = await call({ file: { bosses: [{ name: 'Other', items: [] }] }, sourceName: 'small.json', replace: true, token: tableStateToken(state, { reserves: [], awards: [] }) });
    expect(response.status).toBe(409);
    expect(tx.lootTableEntry.deleteMany).not.toHaveBeenCalled();
  });
});
