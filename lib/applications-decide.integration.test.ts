import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

// After the decision reads the application, `afterRead` runs once: the stand-in for another officer.
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, afterRead: null as null | (() => Promise<unknown>) }));
vi.mock('@/lib/db', () => ({
  get db() {
    return new Proxy(state.db, {
      get(target, key) {
        if (key !== 'application') return Reflect.get(target, key);
        return new Proxy(target.application, {
          get(app, method) {
            if (method !== 'findUnique') return Reflect.get(app, method);
            return async (args: Parameters<typeof app.findUnique>[0]) => {
              const row = await app.findUnique(args);
              const hook = state.afterRead;
              state.afterRead = null;
              await hook?.();
              return row;
            };
          },
        });
      },
    });
  },
}));
vi.mock('server-only', () => ({}));
import { decideApplication, reopenApplication } from './decisions';
import { ackJob } from './outbox';

// DECISIONS_INTEGRATION=1 npx vitest run lib/applications-decide.integration.test.ts
// Like interviews.integration.test.ts, owns a disposable loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.DECISIONS_INTEGRATION !== '1')('decisions on PostgreSQL (SYNC-SPEC §4, Decision request)', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const officer = { userId: 'officer', name: 'Robert', source: 'web' } as const;
  const application = (id: string, path: 'RAIDER' | 'SOCIAL' = 'RAIDER') => db.application.create({ data: { id, path, discordId: id, discordName: id, character: id, answers: {} } });
  const jobs = (id: string) => db.outboxJob.findMany({ where: { type: 'application.decide', payload: { path: ['applicationId'], equals: id } } });
  const moveToSocial = (id: string) => async () => db.application.update({ where: { id }, data: { path: 'SOCIAL' } });

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=decisions_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/decisions_test` });
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
    await db.user.create({ data: { id: 'officer', discordId: 'officer', discordName: 'Robert', role: 'OFFICER' } });
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(() => { state.afterRead = null; });

  it('lets one of two simultaneous decisions win', async () => {
    await application('both');
    const outcomes = await Promise.all([
      decideApplication('both', 'accepted', officer, null, { acceptAs: 'raider' }),
      decideApplication('both', 'declined', officer, null, { message: { kind: 'none' } }),
    ]);
    expect(outcomes.sort()).toEqual(['conflict', 'decided']);
    const row = await db.application.findUniqueOrThrow({ where: { id: 'both' } });
    const [job] = await jobs('both');
    expect(await jobs('both')).toHaveLength(1);
    expect((job.payload as { decisionId: string }).decisionId).toBe(row.decisionId);
  });

  it('refuses Accept as raider after a move to social, with no partial writes', async () => {
    await application('moved');
    state.afterRead = moveToSocial('moved');
    expect(await decideApplication('moved', 'accepted', officer, null, { acceptAs: 'raider' })).toBe('moved');
    expect(await db.application.findUniqueOrThrow({ where: { id: 'moved' } })).toMatchObject({
      status: 'PENDING', path: 'SOCIAL', decidedAt: null, decisionMessageKind: null, decisionMessageText: null, decisionMessageStatus: null, decisionId: null,
    });
    expect(await db.user.findUnique({ where: { discordId: 'moved' } })).toBeNull();
    expect(await jobs('moved')).toHaveLength(0);
  });

  it('decides a decline again on the new path after a move to social', async () => {
    await application('redo');
    state.afterRead = moveToSocial('redo');
    expect(await decideApplication('redo', 'declined', officer, null, { message: { kind: 'custom', text: 'Next tier!' } })).toBe('decided');
    expect(await db.application.findUniqueOrThrow({ where: { id: 'redo' } })).toMatchObject({ status: 'DECLINED', path: 'SOCIAL', decisionMessageKind: 'CUSTOM', decisionMessageText: 'Next tier!', decisionMessageStatus: 'QUEUED' });
    const [job] = await jobs('redo');
    expect(job.payload).toMatchObject({ path: 'social', dm: 'Next tier!', message: { kind: 'custom', text: 'Next tier!' } });
  });

  it('accepts a raider as social, then reopen clears the message and keeps the switch', async () => {
    await application('switch');
    expect(await decideApplication('switch', 'accepted', officer, null, { acceptAs: 'social' })).toBe('decided');
    const decided = await db.application.findUniqueOrThrow({ where: { id: 'switch' } });
    expect(decided).toMatchObject({ status: 'ACCEPTED', path: 'SOCIAL', switchedAt: expect.any(Date), decisionMessageKind: 'STANDARD', decisionMessageStatus: 'QUEUED', decisionId: expect.any(String) });
    expect(await db.user.findUniqueOrThrow({ where: { discordId: 'switch' } })).toMatchObject({ rank: 'SOCIAL', trialStartedAt: null });

    expect(await reopenApplication('switch', officer)).toBe('decided');
    expect(await db.application.findUniqueOrThrow({ where: { id: 'switch' } })).toMatchObject({
      status: 'PENDING', path: 'SOCIAL', switchedAt: decided.switchedAt, decisionMessageKind: null, decisionMessageText: null, decisionMessageStatus: null, decisionId: null,
    });
  });

  it('applies the bot ack to the current decision only: stale and repeated acks change nothing', async () => {
    await application('ack');
    await decideApplication('ack', 'declined', officer, null, {});
    const [first] = await jobs('ack');
    await reopenApplication('ack', officer);
    await decideApplication('ack', 'declined', officer, null, {});
    const second = (await jobs('ack')).find((j) => j.id !== first.id)!;
    const state = async () => (await db.application.findUniqueOrThrow({ where: { id: 'ack' } })).decisionMessageStatus;

    await ackJob(first.id, { ok: true, result: { dmDelivered: true } });
    expect(await state()).toBe('QUEUED');
    await ackJob(second.id, { ok: true, result: { dmDelivered: false } });
    expect(await state()).toBe('NOT_DELIVERED');
    await db.outboxJob.update({ where: { id: second.id }, data: { status: 'RUNNING' } });
    await ackJob(second.id, { ok: true, result: { dmDelivered: true } });
    expect(await state()).toBe('NOT_DELIVERED');
  });

  it('ignores an ack for a decision with no message', async () => {
    await application('none');
    await decideApplication('none', 'declined', officer, null, { message: { kind: 'none' } });
    const [job] = await jobs('none');
    await ackJob(job.id, { ok: true, result: { dmDelivered: false } });
    expect(await db.application.findUniqueOrThrow({ where: { id: 'none' } })).toMatchObject({ decisionMessageKind: 'NONE', decisionMessageStatus: null });
  });
});
