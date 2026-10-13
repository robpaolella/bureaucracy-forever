import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@/lib/generated/prisma/client';

// Opt-in real PostgreSQL proof. Owns a fresh loopback-only container, never an existing DB.
// LOOT_BLOCK_INTEGRATION=1 npx vitest run 'app/api/raids/[id]/reserves/route.integration.test.ts'
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'member', discordId: 'block-test' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'u1' }) }));
import { PUT } from './route';
import { blockedItemIds, setItemBlocked } from '@/lib/loot-blocks';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
};
const save = (sr: number | null = null) => PUT(new Request('http://localhost/test', {
  method: 'PUT', body: JSON.stringify({ characterId: 'c1', hr: 100, sr }),
}), { params: Promise.resolve({ id: 'r1' }) });

// All data is synthetic; the database and container are created and removed by this suite.
describe.skipIf(process.env.LOOT_BLOCK_INTEGRATION !== '1')('real PostgreSQL reserve/block ordering', () => {
  let container: string;
  let pool: Pool;
  let client: PrismaClient;

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=block_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/block_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    // Apply the actual migration chain, including the additive settings migration.
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    }
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    state.db = client;
    await client.raidTemplate.create({ data: { id: 't1', name: 'Block test', short: 'BT', size: 10, requirements: {} } });
    await client.user.create({ data: { id: 'u1', discordId: 'block-test', discordName: 'Sample', characters: { create: { id: 'c1', name: 'Sample', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' } } } });
    await client.raid.create({ data: { id: 'r1', name: 'Block test', templateId: 't1', startsAt: new Date('2099-01-01'), locksAt: new Date('2099-01-01'), requirements: {}, signups: { create: { userId: 'u1', response: 'ACCEPT', source: 'WEB' } } } });
    for (const id of [100, 200]) await client.lootItem.create({ data: { id, name: `Item ${id}`, quality: 4, icon: '', tooltipHtml: '', source: 'CLASSIC', fetchedAt: new Date() } });
    await client.lootBoss.create({ data: { templateId: 't1', name: 'Sample boss', position: 0, entries: { create: [{ itemId: 100, position: 0 }, { itemId: 200, position: 1 }] } } });
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });

  /** Pause the first transaction immediately after its real PostgreSQL tier lock. */
  function pauseFirstLock(match = /RaidTemplate/) {
    const acquired = deferred();
    const release = deferred();
    let first = true;
    state.db = new Proxy(client, { get(target, key) {
      if (key !== '$transaction') return Reflect.get(target, key);
      return (run: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) => target.$transaction(async (tx) => run(new Proxy(tx, { get(t, k) {
        if (k !== '$queryRaw') return Reflect.get(t, k);
        return async (...args: Parameters<typeof tx.$queryRaw>) => {
          const result = await tx.$queryRaw(...args);
          const sql = Array.isArray(args[0]) ? (args[0] as string[]).join('?') : '';
          if (first && match.test(sql)) { first = false; acquired.resolve(); await release.promise; }
          return result;
        };
      } })), { ...options, timeout: 15_000 });
    } });
    return { acquired, release };
  }

  async function waitForBlockedQuery() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const { rows } = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%RaidTemplate%'");
      if (rows.length) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error('Second transaction did not wait for the tier lock');
  }

  it('block first: a waiting save reads the committed block and writes nothing; unblock allows it', async () => {
    const gate = pauseFirstLock();
    const blocking = setItemBlocked('t1', 100, true);
    await gate.acquired.promise;
    const saving = save();
    try { await waitForBlockedQuery(); } finally { gate.release.resolve(); }
    await blocking;
    expect((await saving).status).toBe(409);
    expect(await client.reserve.count()).toBe(0);
    state.db = client;
    await setItemBlocked('t1', 100, false);
    expect(await blockedItemIds('t1')).toEqual(new Set());
    expect((await save()).status).toBe(200);
    await client.reserve.deleteMany();
  }, 20_000);

  it('save first: block waits, sees the new holder and is refused, leaving the setting unblocked', async () => {
    const gate = pauseFirstLock();
    const saving = save();
    await gate.acquired.promise;
    const blocking = setItemBlocked('t1', 100, true);
    try { await waitForBlockedQuery(); } finally { gate.release.resolve(); }
    expect((await saving).status).toBe(200);
    expect(await blocking).toEqual({ ok: false, holders: 1 });
    state.db = client;
    expect(await blockedItemIds('t1')).toEqual(new Set());
    // The first test's unblock left the row at blocked=false; the refusal leaves it there.
    expect(await client.lootReserveSetting.findMany({ select: { itemId: true, blocked: true } })).toEqual([{ itemId: 100, blocked: false }]);
    expect(await client.reserve.count()).toBe(1);
  }, 20_000);

  it('a reserve kept on a blocked item survives editing the other slot unchanged', async () => {
    // A reserve can still sit on a blocked item (one held only on a locked raid when it was
    // blocked); write the setting directly, as setItemBlocked refuses while r1 is unlocked.
    await client.lootReserveSetting.update({ where: { templateId_itemId: { templateId: 't1', itemId: 100 } }, data: { blocked: true } });
    const kept = await client.reserve.findFirstOrThrow({ where: { kind: 'HR' } });
    expect((await save(200)).status).toBe(200);
    expect(await client.reserve.findUnique({ where: { id: kept.id } })).toEqual(kept);
    expect(await client.reserve.count()).toBe(2);
    await client.reserve.deleteMany();
    await client.lootReserveSetting.deleteMany();
  });

  it('a holder only on a locked or past raid does not stop the block', async () => {
    const now = Date.now();
    for (const [id, startsAt] of [['r-past', new Date(now - 86_400_000)], ['r-locked', new Date(now + 60 * 60_000)]] as const) {
      await client.raid.create({ data: { id, name: 'Block test', templateId: 't1', startsAt, locksAt: startsAt, requirements: {} } });
      await client.reserve.create({ data: { raidId: id, userId: 'u1', characterId: 'c1', itemId: 200, kind: 'SR' } });
    }
    expect(await setItemBlocked('t1', 200, true)).toEqual({ ok: true });
    expect(await blockedItemIds('t1')).toEqual(new Set([200]));
    expect(await client.reserve.count({ where: { itemId: 200 } })).toBe(2);
  });

  it('holder row lock: a rank change waits for a save in flight, then a trial is refused', async () => {
    await client.reserve.deleteMany();
    const gate = pauseFirstLock(/FROM "User"/);
    const saving = save();
    await gate.acquired.promise;
    const demoting = Promise.resolve(client.user.update({ where: { id: 'u1' }, data: { rank: 'TRIAL' } })); // Prisma sends nothing until awaited
    try {
      for (let attempt = 0; ; attempt++) {
        const { rows } = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'UPDATE%User%'");
        if (rows.length) break;
        if (attempt === 100) throw new Error('The rank change did not wait for the holder row lock: ' + JSON.stringify((await pool.query('SELECT wait_event_type, state, left(query, 120) q FROM pg_stat_activity WHERE datname = current_database()')).rows));
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } finally { gate.release.resolve(); }
    // The save was first in line: it wrote under the lock, and the rank change landed after it.
    expect((await saving).status).toBe(200);
    await demoting;
    state.db = client;
    expect(await client.reserve.count()).toBe(1);
    // Once the holder is a Trial the same save is refused and the held reserve is untouched.
    const res = await save(200);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Reserves open once your trial ends.' });
    expect(await client.reserve.count()).toBe(1);
    await client.reserve.deleteMany();
    await client.user.update({ where: { id: 'u1' }, data: { rank: 'SOCIAL' } });
  }, 20_000);
});
