import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, open: false }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true, openUntilStart: () => state.open }));
import { GET } from '@/app/api/bot/raids/[id]/route';
import { signupsClosed } from './raid-detail';
import { reservesLocked } from './loot-rules';
import { blockItem, unlockedHolders } from './loot-blocks';
import { runTick } from './tick';

// OPEN_UNTIL_START_VIEWS_INTEGRATION=1 npx vitest run lib/open-until-start-views.integration.test.ts
// Owns a fresh loopback-only PostgreSQL container, never an existing database. All data is synthetic.
describe.skipIf(process.env.OPEN_UNTIL_START_VIEWS_INTEGRATION !== '1')('OPEN_UNTIL_START on the raid page, the bot\'s raid view, the reserve reminder and item blocks', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const MINUTE = 60_000;
  const SECRET = 'open-until-start-views-secret';
  const ME = '100000000000000001';
  const START = new Date('2099-06-01T20:00:00Z');
  const clock = (to: Date) => vi.setSystemTime(to);
  const before = (minutes: number) => new Date(START.getTime() - minutes * MINUTE);

  /** A posted event at START whose stored lock is what creation would store for the setting. */
  async function raid(open: boolean, id = 'raid') {
    return db.raid.create({ data: {
      id, name: 'Sample raid', templateId: 'tier', startsAt: START, requirements: {}, postedAt: new Date('2099-05-20T12:00:00Z'),
      locksAt: open ? START : before(120),
    } });
  }
  async function viewer(raidId: string) {
    const res = await GET(new Request(`http://localhost/api/bot/raids/${raidId}?discordId=${ME}`, { headers: { authorization: `Bearer ${SECRET}` } }), { params: Promise.resolve({ id: raidId }) });
    expect(res.status).toBe(200);
    return (await res.json()).viewer;
  }
  const reminders = () => db.outboxJob.findMany({ where: { type: 'raid.reserves.remind' } });

  beforeAll(async () => {
    process.env.BOT_SHARED_SECRET = SECRET;
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=open_until_start_views_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/open_until_start_views_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    }
    db = new PrismaClient({ adapter: new PrismaPg(pool) }); state.db = db;
  }, 120_000);
  afterAll(async () => { await db?.$disconnect(); await pool?.end(); if (container) docker('stop', container); });
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    state.open = true;
    await pool.query('TRUNCATE "User", "Raid", "RaidTemplate", "LootItem", "OutboxJob" CASCADE');
    await db.user.create({ data: { id: 'member', discordId: ME, discordName: 'member', role: 'MEMBER', rank: 'RAIDER', inGuild: true } });
    await db.character.create({ data: { id: 'main', userId: 'member', name: 'Sample Main', isMain: true, raidRole: 'TANK', class: 'WARRIOR', spec: 'Sample' } });
    await db.lootItem.create({ data: { id: 1, name: 'Item 1', quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'Sample tier', short: 'S', size: 10, requirements: {},
      lootBosses: { create: { id: 'boss', name: 'Boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } },
    } });
  });
  afterEach(() => { vi.useRealTimers(); });

  async function signUp(raidId: string) {
    await db.signup.create({ data: { raidId, userId: 'member', characterId: 'main', response: 'ACCEPT', source: 'WEB' } });
  }

  it('raid page: the stored lock is the start, sign-ups are on 5 minutes before and off at the start', async () => {
    const r = await raid(true);
    const card = { status: r.status, locksAt: r.locksAt.toISOString(), cancelled: false };
    // The page shows this locksAt as "Sign-ups lock" and passes the same card to signupsClosed.
    expect(card.locksAt).toBe(START.toISOString());
    expect(signupsClosed(card, false, before(5))).toBe(false);
    expect(signupsClosed(card, false, START)).toBe(true);
    expect(reservesLocked(r.startsAt, before(5))).toBe(false);
    expect(reservesLocked(r.startsAt, START)).toBe(true);
  });

  it('raid page: with the setting off, sign-ups and reserves lock two hours before', async () => {
    state.open = false;
    const r = await raid(false);
    const card = { status: r.status, locksAt: r.locksAt.toISOString(), cancelled: false };
    expect(signupsClosed(card, false, before(121))).toBe(false);
    expect(signupsClosed(card, false, before(119))).toBe(true);
    expect(reservesLocked(r.startsAt, before(121))).toBe(false);
    expect(reservesLocked(r.startsAt, before(119))).toBe(true);
  });

  it.each([[true, 5, false], [true, 0, true], [false, 5, true], [false, 121, false]])('bot raid view: with the setting %s, reservesLocked %i minutes before the start is %s', async (open, minutes, locked) => {
    state.open = open;
    await raid(open); await signUp('raid');
    clock(before(minutes));
    expect(await viewer('raid')).toMatchObject({ reservesLocked: locked, lootTable: true });
  });

  it('reserve reminder: due in the two hours before the start, sent once, carrying the start as the lock time', async () => {
    await raid(true); await signUp('raid');
    clock(before(121));
    expect((await runTick(before(121))).reservesReminded).toBe(0);
    clock(before(119));
    expect((await runTick(before(119))).reservesReminded).toBe(1);
    clock(before(5));
    expect((await runTick(before(5))).reservesReminded).toBe(0);
    const jobs = await reminders();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].payload).toMatchObject({ raidId: 'raid', discordIds: [ME], reservesLockAt: START.toISOString() });
  });

  it('reserve reminder: not sent from the start, nor in the old window with the setting on', async () => {
    await raid(true); await signUp('raid');
    clock(START);
    expect((await runTick(START)).reservesReminded).toBe(0);
    expect(await reminders()).toHaveLength(0);
  });

  it('reserve reminder: with the setting off, it keeps the old window and the lock two hours before', async () => {
    state.open = false;
    await raid(false); await signUp('raid');
    clock(before(119));
    expect((await runTick(before(119))).reservesReminded).toBe(0);
    clock(before(239));
    expect((await runTick(before(239))).reservesReminded).toBe(1);
    expect((await reminders())[0].payload).toMatchObject({ reservesLockAt: before(120).toISOString() });
  });

  const reserve = (raidId: string) => db.reserve.create({ data: { raidId, userId: 'member', characterId: 'main', itemId: 1, kind: 'SR' } });

  it('item blocks: with the setting on, an event starting in 5 minutes has its reserves listed and removed', async () => {
    const now = before(5);
    await raid(true); await signUp('raid'); await reserve('raid');
    expect(await unlockedHolders(db, 'tier', 1, now)).toHaveLength(1);
    expect(await blockItem('tier', 1, [], now)).toMatchObject({ ok: false });
    const [holder] = await unlockedHolders(db, 'tier', 1, now);
    expect(await blockItem('tier', 1, [holder.key], now)).toEqual({ ok: true, removed: 1 });
    expect(await db.reserve.count()).toBe(0);
    expect(await unlockedHolders(db, 'tier', 1, START)).toHaveLength(0);
  });

  it('item blocks: with the setting on, an event that has started keeps its reserves', async () => {
    await raid(true); await signUp('raid'); await reserve('raid');
    expect(await unlockedHolders(db, 'tier', 1, START)).toHaveLength(0);
    expect(await blockItem('tier', 1, [], START)).toEqual({ ok: true, removed: 0 });
    expect(await db.reserve.count()).toBe(1);
  });

  it('item blocks: an event more than two hours away is listed and removed with the setting on or off', async () => {
    for (const open of [true, false]) {
      state.open = open;
      await db.raid.deleteMany(); await db.lootReserveSetting.deleteMany();
      await raid(open); await signUp('raid'); await reserve('raid');
      const now = before(180);
      expect(await unlockedHolders(db, 'tier', 1, now)).toHaveLength(1);
      expect(await blockItem('tier', 1, [(await unlockedHolders(db, 'tier', 1, now))[0].key], now)).toEqual({ ok: true, removed: 1 });
    }
  });

  it('item blocks: with the setting off, an event starting in 5 minutes keeps its reserves', async () => {
    state.open = false;
    await raid(false); await signUp('raid'); await reserve('raid');
    expect(await unlockedHolders(db, 'tier', 1, before(5))).toHaveLength(0);
    expect(await blockItem('tier', 1, [], before(5))).toEqual({ ok: true, removed: 0 });
  });
});
