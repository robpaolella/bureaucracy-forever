import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, open: false, session: { discordId: 'officer', role: 'officer' } as { discordId: string; role: string } }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ ...state.session, name: 'Sample' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false, openUntilStart: () => state.open }));
import { POST } from '@/app/api/raids/route';
import { PATCH } from '@/app/api/raids/[id]/route';
import { PUT as signUp } from '@/app/api/raids/[id]/signup/route';
import { PUT as switchCharacter } from '@/app/api/raids/[id]/signup/character/route';
import { applyDiscordAnswer } from '@/app/api/bot/raids/_respond';
import { REASONS } from './signup-rules';
import { generateInstances, runTick } from './tick';

// OPEN_UNTIL_START_INTEGRATION=1 npx vitest run lib/open-until-start.integration.test.ts
// Owns a fresh loopback-only PostgreSQL container, never an existing database.
describe.skipIf(process.env.OPEN_UNTIL_START_INTEGRATION !== '1')('OPEN_UNTIL_START across sign-ups, event creation, edits and tick', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const MINUTE = 60_000;
  const form = { templateId: 'tier', date: '2099-06-01', time: '20:00', durationMin: 180, requirements: { tank: 1, healer: 1, melee: 0, ranged: 0 }, notes: '' };
  const json = (body: unknown) => ({ method: 'PUT', body: JSON.stringify(body) });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const raidRow = (id: string) => db.raid.findUniqueOrThrow({ where: { id } });
  const clock = (to: Date) => vi.setSystemTime(to);

  /** Schedule through the officer route with the setting as given, then restore the member. */
  async function schedule(open: boolean, over: Record<string, unknown> = {}) {
    state.open = open; state.session = { discordId: 'officer', role: 'officer' };
    clock(new Date('2099-05-31T12:00:00Z'));
    const res = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ ...form, ...over }) }));
    expect(res.status).toBe(201);
    const raid = await raidRow((await res.json()).id);
    await db.signup.create({ data: { raidId: raid.id, userId: 'member', characterId: 'main', response: 'ACCEPT', source: 'WEB' } });
    state.session = { discordId: 'member', role: 'member' };
    return raid;
  }
  /** What a member can do at a moment: the web answer, the bot's answer and a change of brought character. */
  async function attempts(raidId: string, now: Date) {
    clock(now);
    const web = (await signUp(new Request('http://localhost', json({ response: 'tentative' })), params(raidId))).status;
    const bot = await applyDiscordAnswer(raidId, 'member', { kind: 'respond', response: 'tentative', reason: null });
    const character = await switchCharacter(new Request('http://localhost', json({ characterId: 'alt' })), params(raidId));
    return { web, bot: bot.status, character: character.status, reasons: [bot.body && (bot.body as { reason?: string }).reason, (await character.json() as { error?: string }).error] };
  }

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=open_until_start_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/open_until_start_test` });
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
    await pool.query('TRUNCATE "User", "Raid", "RaidTemplate" CASCADE');
    for (const id of ['member', 'officer']) await db.user.create({ data: { id, discordId: id, discordName: id, role: id === 'officer' ? 'OFFICER' : 'MEMBER', inGuild: false } });
    for (const [id, isMain, raidRole] of [['main', true, 'TANK'], ['alt', false, 'HEALER']] as const) {
      await db.character.create({ data: { id, userId: 'member', name: id, isMain, raidRole, class: 'WARRIOR', spec: 'Sample' } });
    }
    await db.raidTemplate.create({ data: { id: 'tier', name: 'Sample tier', short: 'S', size: 10, requirements: {} } });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('creation: Schedule a raid and tick\'s series both lock at the start with the setting on, two hours before with it off', async () => {
    const on = await schedule(true);
    expect(on.locksAt).toEqual(on.startsAt);
    const off = await schedule(false, { date: '2099-06-02' });
    expect(off.locksAt.getTime()).toBe(off.startsAt.getTime() - 120 * MINUTE);

    const series = await db.raidSeries.create({ data: { templateId: 'tier', weekday: 2, startTime: '20:00', durationMin: 180, horizonWeeks: 2, createdById: 'officer' } });
    for (const open of [true, false]) {
      state.open = open;
      await db.raid.deleteMany({ where: { seriesId: series.id } });
      expect(await generateInstances(new Date('2099-05-01'), [], series.id)).toBeGreaterThan(0);
      const made = await db.raid.findMany({ where: { seriesId: series.id } });
      for (const r of made) expect(r.locksAt.getTime()).toBe(r.startsAt.getTime() - (open ? 0 : 120 * MINUTE));
    }
  });

  it('sign-ups: open 5 minutes before the start on the web, through the bot and for a character change', async () => {
    const raid = await schedule(true);
    const got = await attempts(raid.id, new Date(raid.startsAt.getTime() - 5 * MINUTE));
    expect(got).toMatchObject({ web: 200, bot: 200, character: 200 });
    expect((await db.signup.findFirstOrThrow({ where: { raidId: raid.id } })).characterId).toBe('alt');
  });

  it('sign-ups: refused 5 minutes before the start with the setting off', async () => {
    const raid = await schedule(false);
    const got = await attempts(raid.id, new Date(raid.startsAt.getTime() - 5 * MINUTE));
    expect(got).toMatchObject({ web: 409, bot: 409, character: 409, reasons: [REASONS.locked, REASONS.locked] });
  });

  it.each([0, 1])('boundary: refused %i minute(s) after the start, before tick has marked the event locked', async (after) => {
    const raid = await schedule(true);
    const got = await attempts(raid.id, new Date(raid.startsAt.getTime() + after * MINUTE));
    expect(got).toMatchObject({ web: 409, bot: 409, character: 409, reasons: [REASONS.locked, REASONS.locked] });
    expect((await raidRow(raid.id)).status).toBe('SCHEDULED');
    expect((await db.signup.findFirstOrThrow({ where: { raidId: raid.id } })).characterId).toBe('main');
  });

  it('tick: still open 5 minutes before the start, locked once it runs at the start', async () => {
    const raid = await schedule(true);
    const early = new Date(raid.startsAt.getTime() - 5 * MINUTE);
    clock(early);
    expect((await runTick(early)).locked).toBe(0);
    expect((await raidRow(raid.id)).status).toBe('SCHEDULED');
    clock(raid.startsAt);
    expect((await runTick(raid.startsAt)).locked).toBe(1);
    expect(await raidRow(raid.id)).toMatchObject({ status: 'LOCKED', lockedAt: raid.startsAt });
  });

  it('edit: moves an open event\'s lock to the new start; a locked event stays locked', async () => {
    const raid = await schedule(true);
    state.session = { discordId: 'officer', role: 'officer' };
    clock(new Date('2099-05-31T12:00:00Z'));
    const edit = (date: string) => PATCH(new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ ...form, date }) }), params(raid.id));
    expect((await edit('2099-06-02')).status).toBe(200);
    const moved = await raidRow(raid.id);
    expect(moved.startsAt.getTime()).toBe(raid.startsAt.getTime() + 24 * 60 * MINUTE);
    expect(moved.locksAt).toEqual(moved.startsAt);

    await db.raid.update({ where: { id: raid.id }, data: { status: 'LOCKED', lockedAt: new Date() } });
    expect((await edit('2099-06-03')).status).toBe(200);
    const locked = await raidRow(raid.id);
    expect(locked.status).toBe('LOCKED');
    expect(locked.locksAt).toEqual(locked.startsAt);
    state.session = { discordId: 'member', role: 'member' };
    const got = await attempts(raid.id, new Date(locked.startsAt.getTime() - 5 * MINUTE));
    expect(got).toMatchObject({ web: 409, bot: 409, character: 409 });
  });
});
