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
import { lockReserveTier, setItemBlocked, setItemWinLimit, blockItem } from './loot-blocks';
import { LOAD_TABLE_SELECT, tableStateToken } from './loot-load';
import { POST as addBoss } from '@/app/api/loot/tables/[templateId]/bosses/route';
import { PATCH as editBoss, DELETE as deleteBoss } from '@/app/api/loot/bosses/[bossId]/route';
import { POST as addItem } from '@/app/api/loot/bosses/[bossId]/items/route';
import { DELETE as deleteItem } from '@/app/api/loot/bosses/[bossId]/items/[itemId]/route';

const request = (body: unknown) => new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ templateId: 'tier', bossId: 'boss', itemId: '1' }) };
// LOOT_TIER_LOCK_INTEGRATION=1 npx vitest run lib/loot-blocks.integration.test.ts
// Owns a disposable loopback-only database; never uses an existing database or settings file.
describe.skipIf(process.env.LOOT_TIER_LOCK_INTEGRATION !== '1')('loot-table writer locking on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=tier_lock_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/tier_lock_test` });
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
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.lootItem.createMany({ data: [1, 2].map((id) => ({ id, name: `Item ${id}`, quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() })) });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'Tier', short: 'T', size: 40, requirements: {}, durationMin: 180,
      lootBosses: { create: { id: 'boss', name: 'Boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } },
    } });
  });

  it('does not block an edit on a different tier', async () => {
    await db.raidTemplate.create({ data: { id: 'other', name: 'Other tier', short: 'O', size: 40, requirements: {} } });
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const applying = db.$transaction(async (tx) => {
      await lockReserveTier(tx, 'tier');
      locked();
      await hold;
    }, { timeout: 10_000 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let writing: Promise<Response> | undefined;
    try {
      await ready;
      writing = addBoss(request({ name: 'Independent boss' }), { params: Promise.resolve({ templateId: 'other' }) });
      const result = await Promise.race([
        writing,
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Different tier waited for the lock')), 2000); }),
      ]);
      expect(result.status).toBe(201);
      expect(await db.lootBoss.count({ where: { templateId: 'other' } })).toBe(1);
    } finally {
      clearTimeout(timer);
      release();
      await applying;
      await writing;
    }
  });

  it.each([
    ['add boss', () => addBoss(request({ name: 'New boss' }), ctx)],
    ['edit boss', () => editBoss(request({ name: 'Renamed boss' }), ctx)],
    ['delete boss', () => deleteBoss(request({}), ctx)],
    ['add item', () => addItem(request({ ref: '2', source: 'FOREVER' }), ctx)],
    ['delete item', () => deleteItem(request({}), ctx)],
    ['set win limit', () => setItemWinLimit('tier', 1, 2)],
    ['unblock item', () => setItemBlocked('tier', 1, false)],
    ['block item', () => blockItem('tier', 1, [])],
  ])('%s waits while the apply critical section holds the tier lock', async (_name, write) => {
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    // The apply critical section: acquire the shared lock before fingerprinting table state.
    const applying = db.$transaction(async (tx) => {
      await lockReserveTier(tx, 'tier');
      const before = await tx.raidTemplate.findUniqueOrThrow({ where: { id: 'tier' }, select: LOAD_TABLE_SELECT });
      locked();
      await hold;
      const after = await tx.raidTemplate.findUniqueOrThrow({ where: { id: 'tier' }, select: LOAD_TABLE_SELECT });
      expect(tableStateToken(after)).toBe(tableStateToken(before));
    }, { timeout: 10_000 });
    let writing: Promise<unknown> | undefined;
    try {
      await ready;
      writing = write();
      // Observe an actual PostgreSQL lock wait, not a timing-based "hasn't finished yet".
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const result = await pool.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0) AS waiting');
        if (result.rows[0].waiting) { waiting = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(waiting).toBe(true);
    } finally {
      release();
      await applying;
      const result = await writing;
      if (result instanceof Response) expect(result.status).toBeLessThan(400);
    }
  }, 15_000);
});
