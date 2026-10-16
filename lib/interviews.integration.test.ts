import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { pickWindow } from './interview-slots';

// INTERVIEWS_INTEGRATION=1 npx vitest run lib/interviews.integration.test.ts
// Like characters.integration.test.ts, owns a disposable loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.INTERVIEWS_INTEGRATION !== '1')('one active interview per application on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const application = (id: string) => db.application.create({ data: { id, path: 'RAIDER', discordId: id, discordName: id, character: id, answers: {} } });
  const start = (applicationId: string, attempt: number) => db.interview.create({ data: {
    applicationId, attempt, activeKey: applicationId, requestedById: 'officer', ...pickWindow(new Date('2026-06-10T16:00:00Z')),
  } });
  const refusal = (promise: Promise<unknown>) => promise.then(() => 'written', (error: { code?: string; message?: string }) => error.code ?? error.message);

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=interviews_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/interviews_test` });
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
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });

  it('refuses a second active attempt; an ended one does not block the next', async () => {
    await application('A');
    const first = await start('A', 1);
    expect(first).toMatchObject({ status: 'AWAITING_TIMES', activeKey: 'A', timesRevision: 0, slots: [] });
    expect(await refusal(start('A', 2))).toBe('P2002');

    await db.interview.update({ where: { id: first.id }, data: { status: 'CANCELLED', activeKey: null, endedAt: new Date() } });
    expect(await start('A', 2)).toMatchObject({ attempt: 2, activeKey: 'A' });
    expect(await db.interview.count({ where: { applicationId: 'A' } })).toBe(2);
  });

  it('lets two simultaneous starts have one winner', async () => {
    await application('Race');
    const results = await Promise.all([refusal(start('Race', 1)), refusal(start('Race', 2))]);
    expect(results.sort()).toEqual(['P2002', 'written']);
    expect(await db.interview.count({ where: { applicationId: 'Race' } })).toBe(1);
  });

  it('keeps attempt numbers unique per application, not across them', async () => {
    await application('B');
    await application('C');
    const ended = await start('B', 1);
    await db.interview.update({ where: { id: ended.id }, data: { status: 'CLOSED', activeKey: null } });
    expect(await refusal(start('B', 1))).toBe('P2002');
    expect(await start('C', 1)).toMatchObject({ applicationId: 'C', attempt: 1 });
  });

  it('refuses rows whose activeKey does not match their status', async () => {
    await application('D');
    await application('E');
    const row = await start('D', 1);
    // Ended but still holding the key, or active without it, or keyed to another application.
    await expect(db.interview.update({ where: { id: row.id }, data: { status: 'DONE' } })).rejects.toThrow(/Interview_activeKey_check/);
    await expect(db.interview.update({ where: { id: row.id }, data: { activeKey: null } })).rejects.toThrow(/Interview_activeKey_check/);
    await expect(db.interview.update({ where: { id: row.id }, data: { activeKey: 'E' } })).rejects.toThrow(/Interview_activeKey_check/);
  });

  it('takes an end reason only with NO_TIME, and requires one there', async () => {
    await application('F');
    const row = await start('F', 1);
    await expect(db.interview.update({ where: { id: row.id }, data: { endReason: 'DECLINED' } })).rejects.toThrow(/Interview_endReason_check/);
    await expect(db.interview.update({ where: { id: row.id }, data: { status: 'NO_TIME', activeKey: null } })).rejects.toThrow(/Interview_endReason_check/);
    expect(await db.interview.update({ where: { id: row.id }, data: { status: 'NO_TIME', endReason: 'EXPIRED', activeKey: null } }))
      .toMatchObject({ status: 'NO_TIME', endReason: 'EXPIRED', activeKey: null });
  });

  it('removes interviews with their application', async () => {
    await application('G');
    await start('G', 1);
    await db.application.delete({ where: { id: 'G' } });
    expect(await db.interview.count({ where: { applicationId: 'G' } })).toBe(0);
  });
});
