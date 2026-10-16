import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { pickWindow } from './interview-slots';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
import { answerProposal, bookInterview, cancelInterview, proposeTime, startInterview, submitTimes } from './interviews';
import { decideApplication } from './decisions';

// INTERVIEWS_INTEGRATION=1 npx vitest run lib/interviews.integration.test.ts
// Like characters.integration.test.ts, owns a disposable loopback-only Postgres, never an existing DB.
// Three more one-hour blocks (with a slot at 7 PM on the 10th): the picks meet SYNC-SPEC §12's minimum of 5 blocks on 2 days.
const REST = ['2026-06-11T03:00:00.000Z', '2026-06-11T04:00:00.000Z', '2026-06-11T17:00:00.000Z', '2026-06-11T18:00:00.000Z'];

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
    state.db = db;
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

  describe('through the lifecycle functions', () => {
    const officer = { userId: 'officer' };
    const jobs = (applicationId: string) => db.outboxJob.findMany({ where: { payload: { path: ['applicationId'], equals: applicationId } }, orderBy: { createdAt: 'asc' } })
      .then((rows) => rows.map((j) => j.type));
    beforeAll(async () => {
      await db.user.create({ data: { id: 'officer', discordId: 'officer-discord', discordName: 'Officer' } });
    });

    it('lets two simultaneous starts make one attempt and one request', async () => {
      await application('Two');
      const results = await Promise.all([startInterview('Two', officer), startInterview('Two', officer)]);
      expect(results.map((r) => (r.ok ? 'ok' : r.reason)).sort()).toEqual(['already_active', 'ok']);
      expect(await db.interview.count({ where: { applicationId: 'Two' } })).toBe(1);
      expect(await jobs('Two')).toEqual(['interview.request']);
    });

    it('never leaves an interview active on a decided application when start and decide race', async () => {
      for (let i = 0; i < 5; i++) {
        const id = `Race${i}`;
        await application(id);
        const [start] = await Promise.all([startInterview(id, officer), decideApplication(id, 'declined', { userId: 'officer', name: 'Officer', source: 'web' })]);
        expect(await db.interview.count({ where: { applicationId: id, activeKey: { not: null } } })).toBe(0);
        // Either the start came first and the decision closed it, or the start saw the decision.
        if (start.ok) expect(await db.interview.findFirstOrThrow({ where: { applicationId: id } })).toMatchObject({ status: 'CLOSED' });
        else expect(start.reason).toBe('not_pending');
      }
    });

    it('lets a cancel and a decision race with one ending', async () => {
      await application('End');
      const started = await startInterview('End', officer);
      if (!started.ok) throw new Error(started.error);
      const [cancel] = await Promise.all([cancelInterview(started.interview.id, officer), decideApplication('End', 'accepted', { userId: 'officer', name: 'Officer', source: 'discord' })]);
      const row = await db.interview.findUniqueOrThrow({ where: { id: started.interview.id } });
      expect(row.status).toBe(cancel.ok ? 'CANCELLED' : 'CLOSED');
      expect((await jobs('End')).filter((t) => t === 'interview.ended')).toHaveLength(1);
    });
    it('lets one of two competing edits win, with one times job', async () => {
      await application('Edit');
      const started = await startInterview('Edit', officer, { now: new Date('2026-06-10T16:00:00Z') });
      if (!started.ok) throw new Error(started.error);
      const results = await Promise.all([
        submitTimes(started.interview.id, 'Edit', ['2026-06-11T02:00:00.000Z', ...REST], 'UTC', new Date('2026-06-10T17:00:00Z')),
        submitTimes(started.interview.id, 'Edit', ['2026-06-11T02:30:00.000Z', ...REST], 'UTC', new Date('2026-06-10T17:00:00Z')),
      ]);
      expect(results.map((r) => (r.ok ? 'ok' : r.reason)).sort()).toEqual(['ok', 'wrong_status']);
      expect(await db.interview.findUniqueOrThrow({ where: { id: started.interview.id } })).toMatchObject({ timesRevision: 1 });
      expect((await jobs('Edit')).filter((t) => t === 'interview.times')).toHaveLength(1);
    });

    describe('booking, proposing and answering', () => {
      const requested = new Date('2026-06-10T16:00:00Z');
      const at = new Date('2026-06-10T17:00:00Z');
      const SLOT = '2026-06-11T02:00:00.000Z';
      const SLOT2 = '2026-06-11T02:30:00.000Z';
      const outcome = (r: { ok: boolean; reason?: string }) => (r.ok ? 'ok' : r.reason);
      const withTimes = async (id: string) => {
        await application(id);
        const started = await startInterview(id, officer, { now: requested });
        if (!started.ok) throw new Error(started.error);
        const times = await submitTimes(started.interview.id, id, [SLOT, SLOT2, ...REST], 'UTC', at);
        if (!times.ok) throw new Error(times.error);
        return times.interview.id;
      };

      it('lets one of two officers booking at once win, with one booking job', async () => {
        const id = await withTimes('Book');
        const results = await Promise.all([bookInterview(id, officer, SLOT, 1, at), bookInterview(id, officer, SLOT2, 1, at)]);
        expect(results.map(outcome).sort()).toEqual(['ok', 'wrong_status']);
        const loser = results.find((r) => !r.ok);
        expect(loser).toMatchObject({ status: 409, error: 'This interview is already booked.' });
        expect((await jobs('Book')).filter((t) => t === 'interview.booked')).toHaveLength(1);
      });

      it('lets a booking and the applicant changing times race with one winner', async () => {
        for (let i = 0; i < 5; i++) {
          const app = `Shift${i}`;
          const id = await withTimes(app);
          const [book, edit] = await Promise.all([bookInterview(id, officer, SLOT, 1, at), submitTimes(id, app, [SLOT2, ...REST], 'UTC', at)]);
          const row = await db.interview.findUniqueOrThrow({ where: { id } });
          // Either the booking held the revision and the edit was refused, or the edit landed and the booking must pick again.
          if (book.ok) expect([outcome(edit), row.status, row.timesRevision]).toEqual(['wrong_status', 'BOOKED', 1]);
          else expect([outcome(book), outcome(edit), row.status, row.timesRevision]).toEqual(['times_changed', 'ok', 'TIMES_RECEIVED', 2]);
          const types = await jobs(app);
          expect(types.filter((t) => t === 'interview.booked')).toHaveLength(book.ok ? 1 : 0);
          expect(types.filter((t) => t === 'interview.times')).toHaveLength(book.ok ? 1 : 2);
        }
      });

      it('lets a cancel and an accept race with one ending', async () => {
        for (let i = 0; i < 5; i++) {
          const app = `Accept${i}`;
          const id = await withTimes(app);
          const proposed = await proposeTime(id, officer, '2026-06-11T03:00:00.000Z', at);
          expect(proposed).toMatchObject({ ok: true, interview: { status: 'PROPOSED' } });
          const [cancel, accept] = await Promise.all([cancelInterview(id, officer, at), answerProposal(id, app, 'accept', at)]);
          expect([cancel.ok, accept.ok].filter(Boolean)).toHaveLength(1);
          const row = await db.interview.findUniqueOrThrow({ where: { id } });
          expect(row.status).toBe(cancel.ok ? 'CANCELLED' : 'BOOKED');
          const loser = cancel.ok ? accept : cancel;
          expect(loser).toMatchObject({ status: 409, reason: 'wrong_status' });
          const types = await jobs(app);
          expect(types.filter((t) => t === 'interview.booked' || t === 'interview.ended')).toEqual([cancel.ok ? 'interview.ended' : 'interview.booked']);
        }
      });
    });
  });
});
