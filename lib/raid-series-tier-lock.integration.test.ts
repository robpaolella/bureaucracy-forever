import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
import { lockReserveTier } from './loot-blocks';
import { applyLootTable, LOAD_TABLE_SELECT, protectedItems, tableStateToken } from './loot-load';
import { parseIdsFile } from './loot-import';
import { PATCH } from '@/app/api/raid-series/[id]/route';

const edit = (seriesId: string, templateId: string) => PATCH(
  new Request('https://example.test', { method: 'PATCH', body: JSON.stringify({ templateId }) }),
  { params: Promise.resolve({ id: seriesId }) },
);
// RAID_SERIES_TIER_LOCK_INTEGRATION=1 npx vitest run lib/raid-series-tier-lock.integration.test.ts
// Owns a disposable loopback-only database; never uses an existing database or settings file.
describe.skipIf(process.env.RAID_SERIES_TIER_LOCK_INTEGRATION !== '1')('moving a series\' raids between tiers under the tier lock on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=series_lock_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/series_lock_test` });
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

  const tier = (id: string) => ({
    id, name: id, short: id, size: 40, requirements: { tank: 4, healer: 10, melee: 12, ranged: 14 }, durationMin: 180,
    lootBosses: { create: { id: `${id}-boss`, name: 'Boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } },
  });
  const series = (id: string, templateId: string) => ({ id, templateId, weekday: 4, startTime: '20:00', durationMin: 180, createdById: 'officer', horizonWeeks: 1 });
  const future = (weeks: number) => new Date(Date.UTC(2099, 0, 1 + 7 * weeks, 12));
  const raid = (id: string, seriesId: string, templateId: string, weeks: number) => ({
    id, name: id, seriesId, templateId, startsAt: future(weeks), locksAt: future(weeks), requirements: {},
  });
  beforeEach(async () => {
    await db.lootAward.deleteMany();
    await db.raid.deleteMany();
    await db.raidSeries.deleteMany();
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.lootItem.create({ data: { id: 1, name: 'Item 1', quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: tier('tier-a') });
    await db.raidTemplate.create({ data: tier('tier-b') });
  });

  async function blockedCount() {
    const result = await pool.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0');
    return result.rows[0].n as number;
  }
  async function waitForBlocked(n: number) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if ((await blockedCount()) >= n) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  }
  /** Holds a tier lock in an open transaction until released. */
  async function holdTierLock(templateId: string) {
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const holding = db.$transaction(async (tx) => { await lockReserveTier(tx, templateId); locked(); await hold; }, { timeout: 15_000 });
    await ready;
    return { release: () => { release(); return holding; } };
  }

  it('makes a replace load on the new tier wait for the move, then refuse it as stale and keep the awarded item', async () => {
    await db.raidSeries.create({ data: series('s', 'tier-a') });
    await db.raid.create({ data: raid('r', 's', 'tier-a', 1) });
    await db.lootAward.create({ data: { raidId: 'r', itemId: 1, method: 'DISENCHANT_BANK', recordedById: 'officer' } });
    // Preview taken before the move: nothing on tier-b is protected yet.
    const before = await db.raidTemplate.findUniqueOrThrow({ where: { id: 'tier-b' }, select: LOAD_TABLE_SELECT });
    const request = { templateId: 'tier-b', file: parseIdsFile({ bosses: [{ name: 'Other', items: [] }] }), source: 'FOREVER' as const, token: tableStateToken(before, await protectedItems(db, before)), sourceName: 'sample.json', officerId: 'officer', officerName: 'Sample Officer', replace: true };

    const holder = await holdTierLock('tier-b');
    const editing = edit('s', 'tier-b');
    expect(await waitForBlocked(1)).toBe(true);
    const loading = applyLootTable(request);
    expect(await waitForBlocked(2)).toBe(true);
    await holder.release();

    expect((await editing).status).toBe(200);
    expect(await loading).toMatchObject({ ok: false, status: 409 });
    expect((await db.raid.findUniqueOrThrow({ where: { id: 'r' } })).templateId).toBe('tier-b');
    expect(await db.lootTableEntry.count({ where: { itemId: 1, boss: { templateId: 'tier-b' } } })).toBe(1);
  }, 30_000);

  it('lets two edits moving raids in opposite directions between the same tiers both finish', async () => {
    await db.raidSeries.createMany({ data: [series('s1', 'tier-a'), series('s2', 'tier-b')] });
    await db.raid.create({ data: raid('r1', 's1', 'tier-a', 1) });
    await db.raid.create({ data: raid('r2', 's2', 'tier-b', 1) });
    // With tier-a held, both edits queue; a wrong lock order would deadlock once it is released.
    const holder = await holdTierLock('tier-a');
    const edits = Promise.all([edit('s1', 'tier-b'), edit('s2', 'tier-a')]);
    expect(await waitForBlocked(2)).toBe(true);
    await holder.release();
    const results = await edits;
    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect((await db.raid.findUniqueOrThrow({ where: { id: 'r1' } })).templateId).toBe('tier-b');
    expect((await db.raid.findUniqueOrThrow({ where: { id: 'r2' } })).templateId).toBe('tier-a');
  }, 30_000);

  it('leaves a colliding raid where it is and moves the rest', async () => {
    await db.raidSeries.create({ data: series('s', 'tier-a') });
    // Both raids fall in one guild week; the first one's new slot is the instant the second holds.
    const slot = new Date('2099-01-09T04:00:00Z'); // Thu 8 Jan 2099, 20:00 guild time
    await db.raid.create({ data: { ...raid('moves', 's', 'tier-a', 1), startsAt: new Date('2099-01-07T12:00:00Z') } });
    await db.raid.create({ data: { ...raid('holds', 's', 'tier-a', 1), startsAt: slot } });
    const res = await edit('s', 'tier-b');
    expect(res.status).toBe(200);
    const [moved, held] = await Promise.all([db.raid.findUniqueOrThrow({ where: { id: 'moves' } }), db.raid.findUniqueOrThrow({ where: { id: 'holds' } })]);
    expect(moved.templateId).toBe('tier-a');
    expect(held.templateId).toBe('tier-b');
  }, 30_000);
});
