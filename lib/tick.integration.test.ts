import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false }));
import { notifyVoiceJoin, runTick } from './tick';

// TICK_INTEGRATION=1 npx vitest run lib/tick.integration.test.ts
// Like characters.integration.test.ts, owns a disposable loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.TICK_INTEGRATION !== '1')('interview tick steps on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const start = new Date('2099-06-01T20:00:00.000Z');
  const at = (min: number) => new Date(start.getTime() + min * 60_000);
  const jobs = async (type: string) => db.outboxJob.findMany({ where: { type } });

  async function interview(id: string, data: Record<string, unknown>) {
    await db.user.create({ data: { id: `u-${id}`, discordId: `d-${id}`, discordName: id, rank: 'OFFICER' } });
    await db.application.create({ data: { id: `app-${id}`, discordId: `d-app-${id}`, discordName: id, character: id, path: 'RAIDER', answers: {} } });
    return db.interview.create({ data: { id, applicationId: `app-${id}`, attempt: 1, activeKey: `app-${id}`, requestedById: `u-${id}`, windowStart: at(-60), windowEnd: at(60 * 24), ...data } as never });
  }

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=tick_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/tick_test` });
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

  // Each test starts clean, so one test's interview is not counted by another's ticks.
  beforeEach(async () => {
    await db.application.deleteMany();
    await db.user.deleteMany();
    await db.outboxJob.deleteMany();
  });

  it('two overlapping ticks send one reminder', async () => {
    await interview('remind', { status: 'BOOKED', bookedStart: start, bookedById: 'u-remind' });
    const counts = await Promise.all([runTick(at(-2)), runTick(at(-2))]);
    expect(counts.reduce((n, c) => n + c.interviewsReminded, 0)).toBe(1);
    expect(await jobs('interview.remind')).toHaveLength(1);
    expect((await db.interview.findUniqueOrThrow({ where: { id: 'remind' } })).remindedAt).not.toBeNull();
    expect((await runTick(at(-1))).interviewsReminded).toBe(0);
  });
  it('two overlapping ticks expire one request once, with no heads-up', async () => {
    await interview('expire', { status: 'AWAITING_TIMES', requestedAt: new Date(start.getTime() - 8 * 86_400_000) });
    const counts = await Promise.all([runTick(start), runTick(start)]);
    expect(counts.reduce((n, c) => n + c.interviewsExpired, 0)).toBe(1);
    expect(counts.reduce((n, c) => n + c.interviewsHeadsUp, 0)).toBe(0);
    expect(await jobs('interview.ended')).toHaveLength(1);
    expect(await db.interview.findUniqueOrThrow({ where: { id: 'expire' } })).toMatchObject({ status: 'NO_TIME', endReason: 'EXPIRED', activeKey: null, endedAt: start });
  });
  it('two overlapping ticks send one heads-up', async () => {
    await interview('headsup', { status: 'AWAITING_TIMES', requestedAt: new Date(start.getTime() - 4 * 86_400_000) });
    const counts = await Promise.all([runTick(start), runTick(start)]);
    expect(counts.reduce((n, c) => n + c.interviewsHeadsUp, 0)).toBe(1);
    expect(await jobs('interview.headsup')).toHaveLength(1);
  });
  it('two overlapping ticks lapse one proposal once', async () => {
    await interview('lapse', { status: 'PROPOSED', proposedStart: start });
    const counts = await Promise.all([runTick(start), runTick(start)]);
    expect(counts.reduce((n, c) => n + c.interviewsLapsed, 0)).toBe(1);
    expect((await jobs('interview.ended')).filter((j) => (j.payload as { outcome: string }).outcome === 'lapsed')).toHaveLength(1);
    expect(await db.interview.findUniqueOrThrow({ where: { id: 'lapse' } })).toMatchObject({ status: 'NO_TIME', endReason: 'PROPOSAL_LAPSED', activeKey: null });
  });
  it('two overlapping ticks finish one booking once, with no message', async () => {
    await interview('done', { status: 'BOOKED', bookedStart: start, remindedAt: start });
    const counts = await Promise.all([runTick(at(60)), runTick(at(60))]);
    expect(counts.reduce((n, c) => n + c.interviewsDone, 0)).toBe(1);
    expect(await db.interview.findUniqueOrThrow({ where: { id: 'done' } })).toMatchObject({ status: 'DONE', activeKey: null });
    expect(await db.outboxJob.count({ where: { payload: { path: ['interviewId'], equals: 'done' } } })).toBe(0);
  });
  it('two overlapping ticks queue one application reminder, once per Pacific day', async () => {
    // Created two days before, ticked at 6 PM Pacific on 2099-06-01 (PDT).
    const evening = new Date('2099-06-02T01:00:00.000Z');
    await db.application.create({ data: { id: 'app-rem', discordId: 'd-rem', discordName: 'rem', character: 'rem', path: 'SOCIAL', answers: {}, createdAt: new Date('2099-05-30T20:00:00.000Z') } });
    const counts = await Promise.all([runTick(evening), runTick(evening)]);
    expect(counts.reduce((n, c) => n + c.remindersQueued, 0)).toBe(1);
    const key = '2099-05-30T20:00:00.000Z@2099-06-01';
    expect((await jobs('application.nudge')).map((j) => j.payload)).toEqual([{ applicationId: 'app-rem', key }]);
    expect(await db.application.findUniqueOrThrow({ where: { id: 'app-rem' } })).toMatchObject({ reminderTriedOn: '2099-06-01', reminderKey: key, nudgedAt: null });
    expect((await runTick(new Date(evening.getTime() + 60_000))).remindersQueued).toBe(0);
  });
  it('two overlapping voice joins announce once', async () => {
    await interview('join', { status: 'BOOKED', bookedStart: start });
    const results = await Promise.all([notifyVoiceJoin('d-app-join', at(-5)), notifyVoiceJoin('d-app-join', at(-5))]);
    expect(results.filter((r) => r.notified)).toEqual([{ notified: true, interviewId: 'join' }]);
    expect(await jobs('interview.joined')).toHaveLength(1);
    expect(await notifyVoiceJoin('d-app-join', at(-4))).toEqual({ notified: false });
  });
});
