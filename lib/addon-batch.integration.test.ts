import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
import { writeOperationBatch } from './addon-batch';
import { parseOperation, type Operation } from './addon-operations';
import { lockReserveTier } from './loot-blocks';

// The worked examples of ADDON-SPEC.md section 4.3 (sample data).
const RAID = 'cm9xr2k4a0001';
const AWARD = { type: 'award', id: 'aw-7f3k2m9q', formatVersion: 1, raid: RAID, env: 'staging', boss: 'lb_lucifron', item: 16805, char: 'Ana Vale', user: 'u_ana', method: 'HR', roll: 91, sender: 'Rae Quill', at: 1792001200 };
const CONFIRM = { type: 'confirm', id: 'cf-1x8p4d2s', formatVersion: 1, raid: RAID, env: 'staging', key: AWARD.id, at: 1792001204 };
const VOID = { type: 'void', id: 'vd-5b2n8c1w', formatVersion: 1, raid: RAID, env: 'staging', key: AWARD.id, reason: 'wrong winner', at: 1792001260 };
const NEW_AWARD = { type: 'award', id: 'aw-2h6j9z4b', formatVersion: 1, raid: RAID, env: 'staging', boss: 'lb_lucifron', item: 16805, char: 'Bo Marsh', user: 'u_bo', method: 'SR', roll: 77, sender: 'Rae Quill', at: 1792001300 };
const REPLACE = { type: 'replace', id: 'rp-9c4v6t0e', formatVersion: 1, raid: RAID, env: 'staging', key: AWARD.id, at: 1792001300, award: NEW_AWARD };

function op(input: Record<string, unknown>): Operation {
  const parsed = parseOperation(input);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

// ADDON_BATCH_INTEGRATION=1 npx vitest run lib/addon-batch.integration.test.ts
// Owns a new loopback-only database; never connects to existing data or a settings file.
describe.skipIf(process.env.ADDON_BATCH_INTEGRATION !== '1')('writing add-on operation batches on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const write = (inputs: Record<string, unknown>[], { raidId = RAID, officerId = 'officer-1', via = 'helper' as 'helper' | 'import' } = {}) =>
    writeOperationBatch({ raidId, operations: inputs.map(op), env: 'staging', officerId, receivedAt: new Date(), via });
  const statuses = (results: { status: string; code?: string }[]) => results.map((r) => r.code ?? r.status);
  const awards = () => db.lootAward.findMany({ orderBy: { requestKey: 'asc' } });

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=addon_batch_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/addon_batch_test` });
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
    holder.db = db;
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(async () => {
    await db.lootOperationRejection.deleteMany();
    await db.lootOperation.deleteMany();
    await db.lootAward.deleteMany();
    await db.raid.deleteMany();
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.user.deleteMany();
    for (const id of [16805, 17011]) await db.lootItem.create({ data: { id, name: `Item ${id}`, quality: 4, icon: 'sample', tooltipHtml: '', source: 'CLASSIC', fetchedAt: new Date() } });
    for (const [tier, boss] of [['tier', 'lb_lucifron'], ['other-tier', 'lb_other']]) {
      await db.raidTemplate.create({ data: {
        id: tier, name: tier, short: tier, size: 40, requirements: {}, durationMin: 180,
        lootBosses: { create: { id: boss, name: `Boss ${boss}`, position: 0, entries: { create: { itemId: 16805, position: 0 } } } },
      } });
    }
    await db.raid.create({ data: { id: RAID, name: 'Raid', startsAt: new Date(), locksAt: new Date(), requirements: {}, templateId: 'tier' } });
    await db.raid.create({ data: { id: 'other-raid', name: 'Other', startsAt: new Date(), locksAt: new Date(), requirements: {}, templateId: 'other-tier' } });
    for (const [user, name] of [['u_ana', 'Ana Vale'], ['u_bo', 'Bo Marsh'], ['u_rae', 'Rae Quill']]) {
      await db.user.create({ data: { id: user, discordId: `d-${user}`, discordName: user, characters: { create: { name, class: 'MAGE', spec: 'Fire', raidRole: 'RANGED' } } } });
    }
  });

  it('records an award the way the loot log does, marked as the add-on\'s', async () => {
    expect(statuses(await write([AWARD]))).toEqual(['recorded']);
    const [award] = await awards();
    expect(award).toMatchObject({
      raidId: RAID, bossId: 'lb_lucifron', bossName: 'Boss lb_lucifron', itemId: 16805, characterName: 'Ana Vale', userId: 'u_ana',
      method: 'HR', roll: 91, recordedById: 'officer-1', requestKey: AWARD.id, source: 'ADDON', awardedAt: new Date(AWARD.at * 1000),
      handedOutByName: 'Rae Quill', handedOutById: 'u_rae', deliveredVia: 'HELPER', confirmation: 'ANNOUNCED', practice: false, voidedAt: null,
    });
    expect(await db.lootOperation.findUnique({ where: { opId: AWARD.id } })).toMatchObject({ type: 'AWARD', key: AWARD.id, status: 'APPLIED', deliveredById: 'officer-1' });
  });

  it('stores how the batch arrived: import for a pasted one, helper for an upload', async () => {
    await write([AWARD], { via: 'import' });
    await write([NEW_AWARD], { via: 'helper' });
    expect((await awards()).map((a) => [a.requestKey, a.deliveredVia])).toEqual([[NEW_AWARD.id, 'HELPER'], [AWARD.id, 'IMPORT']]);
  });

  it('answers every operation in the batch\'s order with its outcome word', async () => {
    const results = await write([{ ...VOID, key: NEW_AWARD.id, id: 'vd-pending1' }, AWARD, AWARD, CONFIRM, VOID, { ...NEW_AWARD, id: 'aw-badbad01', item: 17011 }]);
    expect(results.map((r) => r.id)).toEqual(['vd-pending1', AWARD.id, AWARD.id, CONFIRM.id, VOID.id, 'aw-badbad01']);
    expect(statuses(results)).toEqual(['pending', 'recorded', 'replayed', 'recorded', 'voided', 'item-not-in-table']);
    expect(results[5]).toEqual({ id: 'aw-badbad01', status: 'rejected', code: 'item-not-in-table' });
    expect(await awards()).toMatchObject([{ requestKey: AWARD.id, confirmation: 'CONFIRMED', confirmedAt: new Date(CONFIRM.at * 1000), voidReason: 'wrong winner' }]);
  });

  it.each([
    ['raid-cancelled', AWARD, () => db.raid.update({ where: { id: RAID }, data: { cancelledAt: new Date() } })],
    ['item-not-in-table', { ...AWARD, item: 17011 }, null],
    ['unknown-boss', { ...AWARD, boss: 'lb_other' }, null],
    ['unknown-character', { ...AWARD, char: 'Nobody Here' }, null],
    ['user-mismatch', { ...AWARD, user: 'u_bo' }, null],
  ] as const)('refuses an award with %s, changes no loot, keeps it as a problem and goes on with the batch', async (code, bad, setup) => {
    await setup?.();
    const results = await write([bad, { ...VOID, key: 'aw-nothing1' }]);
    expect(results).toEqual([{ id: AWARD.id, status: 'rejected', code }, { id: VOID.id, status: 'pending' }]);
    expect(await awards()).toEqual([]);
    expect(await db.lootOperation.findMany({ select: { opId: true } })).toEqual([{ opId: VOID.id }]);
    expect(await db.lootOperationRejection.findMany()).toMatchObject([{ raidId: RAID, opId: AWARD.id, code, deliveredById: 'officer-1' }]);
    // The helper sending it again is still one problem.
    await write([bad]);
    expect(await db.lootOperationRejection.count()).toBe(1);
  });

  it('records disenchant/bank with no winner', async () => {
    expect(statuses(await write([{ ...AWARD, method: 'DISENCHANT_BANK', char: undefined, user: undefined }]))).toEqual(['recorded']);
    expect(await awards()).toMatchObject([{ characterId: null, characterName: null, userId: null, method: 'DISENCHANT_BANK' }]);
  });

  it('refuses a replace whose new award can\'t be recorded, whether its original is held or not, and holds nothing', async () => {
    const bad = { ...REPLACE, award: { ...NEW_AWARD, item: 17011 } };
    expect(statuses(await write([bad]))).toEqual(['item-not-in-table']);
    expect(await db.lootOperation.count()).toBe(0);
    await write([AWARD]);
    expect(statuses(await write([bad]))).toEqual(['item-not-in-table']);
    expect(await awards()).toMatchObject([{ requestKey: AWARD.id, voidedAt: null }]);
    expect(await db.lootOperation.findMany({ where: { status: 'PENDING' } })).toEqual([]);
  });

  it('a void that arrives before its award, then the award in a later batch, ends with the award voided', async () => {
    expect(statuses(await write([VOID], { officerId: 'officer-2' }))).toEqual(['pending']);
    expect(statuses(await write([AWARD]))).toEqual(['voided']);
    expect(await awards()).toMatchObject([{ requestKey: AWARD.id, voidedById: 'officer-2', voidReason: 'wrong winner' }]);
    expect(await db.lootOperation.findUnique({ where: { opId: VOID.id } })).toMatchObject({ status: 'APPLIED' });
  });

  it('a replacement held for its original records its new award when the original arrives later', async () => {
    expect(statuses(await write([REPLACE], { officerId: 'officer-2' }))).toEqual(['pending']);
    expect(statuses(await write([AWARD]))).toEqual(['voided']);
    expect(await awards()).toMatchObject([
      { requestKey: NEW_AWARD.id, characterName: 'Bo Marsh', userId: 'u_bo', recordedById: 'officer-2', voidedAt: null },
      { requestKey: AWARD.id, voidedById: 'officer-2' },
    ]);
  });

  it('two helpers uploading overlapping batches at once record each award once and apply every void', async () => {
    for (let round = 0; round < 10; round++) {
      await db.lootOperation.deleteMany();
      await db.lootAward.deleteMany();
      const second = { ...VOID, id: 'vd-second01', key: NEW_AWARD.id };
      // The third shares no id with the others, so only the raid's lock keeps its void from being held forever.
      const [a, b, c] = await Promise.all([
        write([AWARD, CONFIRM, NEW_AWARD], { officerId: 'officer-1' }),
        write([NEW_AWARD, VOID, AWARD, second], { officerId: 'officer-2' }),
        write([{ ...VOID, id: 'vd-third001' }], { officerId: 'officer-3' }),
      ]);
      expect([...statuses(a), ...statuses(b), ...statuses(c)]).not.toContain('rejected');
      expect(await awards()).toMatchObject([
        { requestKey: NEW_AWARD.id, voidReason: 'wrong winner' },
        { requestKey: AWARD.id, voidReason: 'wrong winner', confirmation: 'CONFIRMED' },
      ]);
      expect(await db.lootOperation.count()).toBe(6);
      expect(await db.lootOperation.count({ where: { status: 'PENDING' } })).toBe(0);
    }
  });

  it('two raids claiming one key at the same moment: one records it, the other is told key-conflict', async () => {
    for (let round = 0; round < 5; round++) {
      await db.lootOperation.deleteMany();
      await db.lootAward.deleteMany();
      await db.lootOperationRejection.deleteMany();
      const results = await Promise.all([
        write([AWARD]),
        write([{ ...AWARD, raid: 'other-raid', boss: 'lb_other' }], { raidId: 'other-raid' }),
      ]);
      expect(results.map(statuses).flat().sort()).toEqual(['key-conflict', 'recorded']);
      expect(await db.lootAward.count()).toBe(1);
    }
  });

  it('a held replacement and another raid\'s award claiming its new key at once: one is told key-conflict', async () => {
    for (let round = 0; round < 10; round++) {
      await db.lootOperationRejection.deleteMany();
      await db.lootOperation.deleteMany();
      await db.lootAward.deleteMany();
      const results = await Promise.all([
        write([REPLACE]),
        write([{ ...NEW_AWARD, raid: 'other-raid', boss: 'lb_other' }], { raidId: 'other-raid' }),
      ]);
      expect([['key-conflict', 'pending'], ['key-conflict', 'recorded']]).toContainEqual(results.map(statuses).flat().sort());
      // The original arriving later still saves.
      expect(statuses(await write([AWARD]))).toHaveLength(1);
      expect(await db.lootAward.count({ where: { requestKey: NEW_AWARD.id } })).toBe(1);
    }
  });

  it('a held replacement keeps the winner it was checked against when the name later belongs to someone else', async () => {
    await write([REPLACE]);
    await db.character.update({ where: { name: 'Bo Marsh' }, data: { name: 'Bo Renamed' } });
    await db.user.create({ data: { id: 'u_cy', discordId: 'd-u_cy', discordName: 'u_cy', characters: { create: { name: 'Bo Marsh', class: 'MAGE', spec: 'Fire', raidRole: 'RANGED' } } } });
    await write([AWARD]);
    expect(await db.lootAward.findUnique({ where: { requestKey: NEW_AWARD.id } })).toMatchObject({ characterId: null, characterName: 'Bo Marsh', userId: 'u_bo' });
  });

  it('waits for a loot-table edit holding the tier lock, as the loot log does', async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const holding = db.$transaction(async (tx) => {
      await lockReserveTier(tx, 'tier');
      locked();
      await hold;
      // The edit removes the item before the batch may look.
      await tx.lootTableEntry.deleteMany({ where: { itemId: 16805 } });
    }, { timeout: 10_000 });
    await ready;
    const writing = write([AWARD]);
    let waiting = false;
    for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
      const r = await pool.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0) AS waiting');
      waiting = r.rows[0].waiting;
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(waiting).toBe(true);
    release();
    await holding;
    expect(statuses(await writing)).toEqual(['item-not-in-table']);
  });

  it('refuses everything for a raid the site doesn\'t hold, and keeps it as a problem', async () => {
    const results = await write([{ ...AWARD, raid: 'missing-raid' }, { ...VOID, env: 'production', raid: 'missing-raid' }], { raidId: 'missing-raid' });
    expect(statuses(results)).toEqual(['unknown-raid', 'wrong-environment']);
    expect(await db.lootOperationRejection.count()).toBe(2);
  });
});
