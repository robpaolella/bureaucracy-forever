import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, session: { discordId: 'd-member', role: 'member' } as { discordId: string; role: string } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ ...state.session, name: 'Sample' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true, openUntilStart: () => false }));
import { GET, PUT } from '@/app/api/raids/[id]/reserves/route';
import type { ReserveWindowData } from './loot-data';
import { loadActiveReserves, loadLootTable, loadReserveTargets } from './loot-data';
import { lockReserveTier, setReservesAllowed, unlockedHolders } from './loot-blocks';
import { REASONS } from './loot-rules';
import { loadRaidView } from './raid-view';
import { generateInstances, runTick } from './tick';

const MIGRATION = '20261023120000_raid_reserves_allowed';
const START = new Date('2099-06-01T20:00:00.000Z');
const params = { params: Promise.resolve({ id: 'raid' }) };
const put = (body: unknown) => PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }), params);
const get = async () => GET(new Request('http://localhost'), params);
const as = (who: 'member' | 'officer') => { state.session = { discordId: `d-${who}`, role: who }; };

// RESERVES_SWITCH_INTEGRATION=1 npx vitest run lib/reserves-switch.integration.test.ts
// Owns a disposable loopback-only PostgreSQL container, never an existing database or settings file.
describe.skipIf(process.env.RESERVES_SWITCH_INTEGRATION !== '1')('the per-raid reserves switch on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient, existingAfterMigration: unknown;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const stored = () => db.reserve.findMany({ where: { raidId: 'raid' }, orderBy: { kind: 'asc' }, select: { id: true, kind: true, itemId: true } });

  /** Waits until PostgreSQL reports a session blocked on a lock, not just a slow call. */
  async function someoneWaits(): Promise<boolean> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await pool.query('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND cardinality(pg_blocking_pids(pid)) > 0) AS waiting');
      if (result.rows[0].waiting) return true;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
  }

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=reserves_switch_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/reserves_switch_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    const folders = readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort();
    expect(folders.at(-1)).toBe(MIGRATION);
    for (const folder of folders.slice(0, -1)) await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    // A raid that exists before the migration, to show existing rows read yes.
    await pool.query(`INSERT INTO "Raid" ("id", "name", "startsAt", "requirements", "locksAt", "updatedAt") VALUES ('existing', 'Old raid', now(), '{}', now(), now())`);
    await pool.query(readFileSync(`prisma/migrations/${MIGRATION}/migration.sql`, 'utf8'));
    existingAfterMigration = (await pool.query(`SELECT "reservesAllowed" FROM "Raid" WHERE "id" = 'existing'`)).rows[0]?.reservesAllowed;
    db = new PrismaClient({ adapter: new PrismaPg(pool) });
    state.db = db;
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE "User", "Raid", "RaidTemplate", "LootItem", "OutboxJob" CASCADE');
    for (const who of ['member', 'officer'] as const) {
      await db.user.create({ data: { id: who, discordId: `d-${who}`, discordName: who, role: who === 'officer' ? 'OFFICER' : 'MEMBER' } });
      await db.character.create({ data: { id: `${who}-main`, userId: who, name: `${who} Main`, isMain: true, raidRole: 'TANK', class: 'WARRIOR', spec: 'Sample' } });
    }
    await db.lootItem.createMany({ data: [1, 2, 3].map((id) => ({ id, name: `Item ${id}`, quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() })) });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'Tier', short: 'T', size: 40, requirements: {},
      lootBosses: { create: { id: 'boss', name: 'Boss', position: 0, entries: { create: [1, 2, 3].map((itemId, position) => ({ itemId, position })) } } },
    } });
    await db.raid.create({ data: { id: 'raid', name: 'Sample raid', startsAt: START, locksAt: START, requirements: {}, templateId: 'tier', postedAt: new Date('2099-05-01') } });
    for (const who of ['member', 'officer']) await db.signup.create({ data: { raidId: 'raid', userId: who, characterId: `${who}-main`, response: 'ACCEPT', source: 'WEB' } });
    await db.reserve.createMany({ data: ([{ kind: 'HR', itemId: 1 }, { kind: 'SR', itemId: 2 }] as const).map((r) => ({ ...r, raidId: 'raid', userId: 'member', characterId: 'member-main' })) });
    as('member');
  });

  it('migration: existing raids read yes, new raids and series instances default to yes', async () => {
    expect(existingAfterMigration).toBe(true);
    expect((await db.raid.findUniqueOrThrow({ where: { id: 'raid' } })).reservesAllowed).toBe(true);
    const series = await db.raidSeries.create({ data: { templateId: 'tier', weekday: 2, startTime: '20:00', durationMin: 180, horizonWeeks: 2, createdById: 'officer' } });
    expect(await generateInstances(new Date('2099-05-01'), [], series.id)).toBeGreaterThan(0);
    const made = await db.raid.findMany({ where: { seriesId: series.id } });
    expect(made.length).toBeGreaterThan(0);
    for (const raid of made) expect(raid.reservesAllowed).toBe(true);
  });

  it('on: GET and PUT work as before', async () => {
    const window = (await (await get()).json()) as ReserveWindowData;
    expect(window.reservesAllowed).toBe(true);
    expect(window.reserves).toHaveLength(2);
    expect(window.targets.find((t) => t.self)?.current).toEqual({ characterId: 'member-main', hr: 1, sr: 2 });
    expect((await put({ characterId: 'member-main', hr: 3, sr: 2 })).status).toBe(200);
    as('officer');
    expect((await put({ characterId: 'member-main', hr: 1, sr: 3, forUserId: 'member' })).status).toBe(200);
    expect((await stored()).map((r) => r.itemId)).toEqual([1, 3]);
  });

  it.each(['member', 'officer'] as const)('off: GET for a %s returns the off state, no reserves and no current picks', async (who) => {
    expect(await setReservesAllowed('raid', false)).toBe(true);
    as(who);
    const res = await get();
    expect(res.status).toBe(200);
    const window = (await res.json()) as ReserveWindowData;
    expect(window.reservesAllowed).toBe(false);
    expect(window.reserves).toEqual([]);
    expect(window.targets.length).toBeGreaterThan(0);
    for (const t of window.targets) expect(t.current).toMatchObject({ hr: null, sr: null });
  });

  it.each([
    ['a member\'s save', 'member', { characterId: 'member-main', hr: 3, sr: null }],
    ['an officer\'s change for someone else', 'officer', { characterId: 'member-main', hr: 3, sr: 2, forUserId: 'member' }],
    ['a clear', 'member', { characterId: 'member-main', hr: null, sr: null }],
  ] as const)('off: PUT refuses %s with 409 and leaves stored reserves alone', async (_name, who, body) => {
    const before = await stored();
    await setReservesAllowed('raid', false);
    as(who);
    const res = await put(body);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: REASONS.reservesOff });
    expect(await stored()).toEqual(before);
  });

  it('off then on: the same stored reserves come back, none deleted', async () => {
    const before = await stored();
    await setReservesAllowed('raid', false);
    expect(await stored()).toEqual(before);
    expect(await loadActiveReserves('raid')).toEqual([]);
    await setReservesAllowed('raid', true);
    expect(await stored()).toEqual(before);
    expect((await loadActiveReserves('raid')).map((r) => [r.kind, r.itemId])).toEqual([['HR', 1], ['SR', 2]]);
  });

  it('off: officers\' reserve views and loot-log markers get none; the loot log keeps the tier\'s items; blocks skip the raid', async () => {
    await setReservesAllowed('raid', false);
    expect(await loadActiveReserves('raid')).toEqual([]);
    const { targets, trialClear } = await loadReserveTargets('raid', 'd-officer', true);
    expect(targets.find((t) => t.userId === 'member')?.current).toEqual({ characterId: 'member-main', hr: null, sr: null });
    expect(trialClear).toBeNull();
    expect(Object.keys((await loadLootTable('tier', { allowEmpty: true }))!.items).map(Number)).toEqual([1, 2, 3]);
    expect(await unlockedHolders(db, 'tier', 1, new Date('2099-05-01'))).toEqual([]);
    await setReservesAllowed('raid', true);
    expect(await unlockedHolders(db, 'tier', 1, new Date('2099-05-01'))).toHaveLength(1);
  });

  it('bot raid view: lootTable is false with the switch off and true with it on', async () => {
    expect((await loadRaidView('raid', 'd-member'))?.viewer?.lootTable).toBe(true);
    await setReservesAllowed('raid', false);
    expect((await loadRaidView('raid', 'd-member'))?.viewer?.lootTable).toBe(false);
    await setReservesAllowed('raid', true);
    expect((await loadRaidView('raid', 'd-member'))?.viewer?.lootTable).toBe(true);
  });

  it('tick: no reserve reminder with the switch off; the usual one once it is back on', async () => {
    await db.reserve.deleteMany();
    const now = new Date(START.getTime() - 3 * 60 * 60_000);
    await setReservesAllowed('raid', false);
    expect((await runTick(now)).reservesReminded).toBe(0);
    expect(await db.outboxJob.count({ where: { type: 'raid.reserves.remind' } })).toBe(0);
    expect((await db.raid.findUniqueOrThrow({ where: { id: 'raid' } })).remindReservesAt).toBeNull();
    await setReservesAllowed('raid', true);
    expect((await runTick(now)).reservesReminded).toBe(1);
    const [job] = await db.outboxJob.findMany({ where: { type: 'raid.reserves.remind' } });
    expect(job.payload).toMatchObject({ raidId: 'raid', discordIds: ['d-member', 'd-officer'] });
  });

  it('a save waiting on a switch-off reads it off once the lock frees, and is refused', async () => {
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    // setReservesAllowed's steps, paused after the write with the lock still held.
    const switching = db.$transaction(async (tx) => {
      await lockReserveTier(tx, 'tier');
      await tx.raid.update({ where: { id: 'raid' }, data: { reservesAllowed: false } });
      locked();
      await hold;
    }, { isolationLevel: 'ReadCommitted', timeout: 10_000 });
    let saving: Promise<Response> | undefined;
    try {
      await ready;
      saving = put({ characterId: 'member-main', hr: 3, sr: null });
      expect(await someoneWaits()).toBe(true);
    } finally {
      release();
      await switching;
    }
    expect((await saving!).status).toBe(409);
    expect((await stored()).map((r) => r.itemId)).toEqual([1, 2]);
  }, 15_000);

  it('the switch waits for a save that holds the lock, so the save commits before it', async () => {
    let locked!: () => void, release!: () => void;
    const ready = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    // A save holding the tier lock, as the reserves PUT does before it writes.
    const saving = db.$transaction(async (tx) => {
      await lockReserveTier(tx, 'tier');
      locked();
      await hold;
      await tx.reserve.updateMany({ where: { raidId: 'raid', kind: 'HR' }, data: { itemId: 3 } });
    }, { isolationLevel: 'ReadCommitted', timeout: 10_000 });
    let switching: Promise<boolean> | undefined;
    try {
      await ready;
      switching = setReservesAllowed('raid', false);
      expect(await someoneWaits()).toBe(true);
      expect((await db.raid.findUniqueOrThrow({ where: { id: 'raid' } })).reservesAllowed).toBe(true);
    } finally {
      release();
      await saving;
    }
    expect(await switching!).toBe(true);
    expect((await db.raid.findUniqueOrThrow({ where: { id: 'raid' } })).reservesAllowed).toBe(false);
    expect((await stored()).map((r) => r.itemId)).toEqual([3, 2]);
  }, 15_000);

  it('setReservesAllowed returns false for an unknown raid', async () => {
    expect(await setReservesAllowed('missing', false)).toBe(false);
  });
});
