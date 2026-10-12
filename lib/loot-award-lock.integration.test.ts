import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'officer-user' }) }));
import { lockReserveTier } from './loot-blocks';
import { POST as recordAward } from '@/app/api/raids/[id]/loot/route';

const award = () => recordAward(
  new Request('https://example.test', { method: 'POST', body: JSON.stringify({ itemId: 1, method: 'DISENCHANT_BANK' }) }),
  { params: Promise.resolve({ id: 'raid' }) },
);
// LOOT_TIER_LOCK_INTEGRATION=1 npx vitest run lib/loot-award-lock.integration.test.ts
// Owns a disposable loopback-only database; never uses an existing database or settings file.
describe.skipIf(process.env.LOOT_TIER_LOCK_INTEGRATION !== '1')('recording a loot award under the tier lock on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=award_lock_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/award_lock_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    }
    db = new PrismaClient({ adapter: new PrismaPg(pool) });
    state.db = db;
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(async () => {
    await db.lootAward.deleteMany();
    await db.raid.deleteMany();
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.lootItem.create({ data: { id: 1, name: 'Item 1', quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'Tier', short: 'T', size: 40, requirements: {}, durationMin: 180,
      lootBosses: { create: { id: 'boss', name: 'Boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } },
    } });
    await db.raid.create({ data: { id: 'raid', name: 'Raid', startsAt: new Date(), locksAt: new Date(), requirements: {}, templateId: 'tier' } });
  });

  /** Holds the tier lock in an open transaction; `change` runs once it is held. */
  async function holdTierLock(change?: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<unknown>) {
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const holding = db.$transaction(async (tx) => {
      await lockReserveTier(tx, 'tier');
      await change?.(tx);
      locked();
      await hold;
    }, { timeout: 10_000 });
    await ready;
    return { release: () => { release(); return holding; } };
  }

  async function waitForLockWait() {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await pool.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0) AS waiting');
      if (result.rows[0].waiting) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  }

  it('refuses an award for an item removed while it was being recorded, and saves nothing', async () => {
    const removal = await holdTierLock((tx) => tx.lootTableEntry.deleteMany({ where: { bossId: 'boss', itemId: 1 } }));
    const recording = award();
    try {
      expect(await waitForLockWait()).toBe(true);
    } finally {
      await removal.release();
    }
    const res = await recording;
    expect(res.status).toBe(409);
    expect(await db.lootAward.count()).toBe(0);
  }, 15_000);

  it('waits for the tier lock and then records an award for an item still on the table', async () => {
    const other = await holdTierLock();
    const recording = award();
    try {
      expect(await waitForLockWait()).toBe(true);
    } finally {
      await other.release();
    }
    expect((await recording).status).toBe(201);
    expect(await db.lootAward.count({ where: { itemId: 1, raidId: 'raid' } })).toBe(1);
  }, 15_000);
});
