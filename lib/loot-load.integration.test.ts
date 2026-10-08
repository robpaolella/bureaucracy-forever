import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
import { applyLootTable, LOAD_TABLE_SELECT, lootLoadHistory, mergePreview, tableStateToken } from './loot-load';
import { parseIdsFile } from './loot-import';

// LOOT_LOAD_INTEGRATION=1 npx vitest run lib/loot-load.integration.test.ts
// Owns a new loopback-only database; never connects to existing data or a settings file.
describe.skipIf(process.env.LOOT_LOAD_INTEGRATION !== '1')('loot-table loads on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const state = () => db.raidTemplate.findUniqueOrThrow({ where: { id: 'tier' }, select: LOAD_TABLE_SELECT });
  const file = parseIdsFile({ bosses: [{ name: 'Boss', trash: true, items: [1, 2, 999] }, { name: 'New', items: [3, 2] }, { name: 'Trash', trash: true, items: [999] }] });
  const input = async () => ({ templateId: 'tier', file, source: 'FOREVER' as const, token: tableStateToken(await state()), sourceName: 'sample.json', officerId: 'officer', officerName: 'Sample Officer' });
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=loot_load_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/loot_load_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    db = new PrismaClient({ adapter: new PrismaPg(pool) }); holder.db = db;
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect(); await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(async () => {
    await db.lootTableLoad.deleteMany(); await db.raidTemplate.deleteMany(); await db.lootItem.deleteMany();
    await db.lootItem.createMany({ data: [1, 2, 3, 4].map((id) => ({ id, name: `Item ${id}`, quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() })) });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'Tier', short: 'T', size: 40, requirements: {},
      lootBosses: { create: [
        { id: 'boss', name: 'Boss', position: 7, entries: { create: [{ itemId: 1, position: 5 }, { itemId: 4, position: 9 }] } },
        { id: 'keep', name: 'Keep', position: 10, isTrash: true },
      ] }, reserveSettings: { create: { itemId: 1, blocked: true, winLimit: 3 } },
    } });
  });
  it('writes exactly the preview additions and one audit snapshot, then refuses a repeat token', async () => {
    const before = await state(), request = await input();
    const preview = mergePreview(before, file, new Set([1, 2, 3, 4]));
    expect(await applyLootTable(request)).toEqual({ ok: true, added: preview.added, newBosses: preview.newBosses });
    const after = await state();
    expect(after.reserveSettings).toEqual(before.reserveSettings);
    expect(after.lootBosses.slice(0, 2).map(({ entries, ...boss }) => ({ ...boss, entries: entries.filter((entry) => entry.itemId !== 2) }))).toEqual(before.lootBosses);
    expect(after.lootBosses.map((boss) => [boss.name, boss.position, boss.isTrash, boss.entries.map((entry) => [entry.itemId, entry.position])])).toEqual([
      ['Boss', 7, false, [[1, 5], [4, 9], [2, 10]]], ['Keep', 10, true, []], ['New', 11, false, [[3, 0], [2, 1]]], ['Trash', 12, true, []],
    ]);
    expect(await db.lootTableLoad.findMany()).toEqual([expect.objectContaining({ templateId: 'tier', sourceName: 'sample.json', officerId: 'officer', officerName: 'Sample Officer', mode: 'merge', added: 3, removed: 0, createdAt: expect.any(Date) })]);
    expect(await applyLootTable(request)).toEqual({ ok: false, status: 409, error: 'The table changed since this preview.' });
    expect(await state()).toEqual(after);
    expect(await db.lootTableLoad.count()).toBe(1);
  });
  it('refuses a changed preview and an unknown tier without any writes', async () => {
    const request = await input();
    await db.lootReserveSetting.update({ where: { templateId_itemId: { templateId: 'tier', itemId: 1 } }, data: { winLimit: 4 } });
    const before = await state();
    expect(await applyLootTable(request)).toMatchObject({ ok: false, status: 409 });
    expect(await applyLootTable({ ...request, templateId: 'missing' })).toMatchObject({ ok: false, status: 404 });
    expect(await state()).toEqual(before); expect(await db.lootTableLoad.count()).toBe(0);
  });
  it('rolls back every addition when PostgreSQL refuses the audit insert', async () => {
    const before = await state();
    await pool.query('ALTER TABLE "LootTableLoad" ADD CONSTRAINT test_failure CHECK ("sourceName" <> \'fail.json\')');
    try { await expect(applyLootTable({ ...await input(), sourceName: 'fail.json' })).rejects.toThrow(); }
    finally { await pool.query('ALTER TABLE "LootTableLoad" DROP CONSTRAINT test_failure'); }
    expect(await state()).toEqual(before); expect(await db.lootTableLoad.count()).toBe(0);
  });
  it('does not write or audit a no-op, including uncached ids on an existing boss', async () => {
    const before = await state();
    expect(await applyLootTable({ ...await input(), file: parseIdsFile({ bosses: [{ name: 'Boss', items: [1, 999] }] }) })).toEqual({ ok: true, added: 0, newBosses: 0 });
    expect(await state()).toEqual(before); expect(await db.lootTableLoad.count()).toBe(0);
  });
  it('serializes concurrent applies so just one succeeds and is audited', async () => {
    const request = await input();
    const results = await Promise.all([applyLootTable(request), applyLootTable(request)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, status: 409, error: 'The table changed since this preview.' }]);
    expect(await db.lootTableLoad.count()).toBe(1);
  });
  it('refuses conflicting cached sources without writing', async () => {
    await db.lootItem.update({ where: { id: 2 }, data: { source: 'CLASSIC' } });
    const before = await state();
    expect(await applyLootTable(await input())).toMatchObject({ ok: false, status: 409, conflicts: [2] });
    expect(await state()).toEqual(before); expect(await db.lootTableLoad.count()).toBe(0);
  });
  it('returns the newest ten snapshots, supports replace mode, and returns no history for a never-loaded tier', async () => {
    expect(await lootLoadHistory('tier')).toEqual([]);
    await db.lootTableLoad.createMany({ data: Array.from({ length: 11 }, (_, i) => ({ templateId: 'tier', sourceName: `load-${i}`, officerId: 'removed-account', officerName: 'Original Name', mode: i === 10 ? 'replace' : 'merge', added: i, removed: 0, createdAt: new Date(Date.UTC(2026, 0, i + 1)) })) });
    await db.raidTemplate.create({ data: { id: 'other', name: 'Other', short: 'O', size: 40, requirements: {}, lootLoads: { create: { sourceName: 'other-tier', officerId: 'other-officer', officerName: 'Other Officer', added: 100 } } } });
    const history = await lootLoadHistory('tier');
    expect(history.map((row) => row.sourceName)).toEqual(Array.from({ length: 10 }, (_, i) => `load-${10 - i}`));
    expect(history[0]).toEqual({ sourceName: 'load-10', officerName: 'Original Name', mode: 'replace', added: 10, removed: 0, createdAt: new Date('2026-01-11T00:00:00Z') });
    expect(await lootLoadHistory('missing')).toEqual([]);
    expect(await lootLoadHistory('other')).toHaveLength(1);
  });
});
