import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
import { CLAIM_LIFETIME_MS, reply, WAIT_MS, withIdempotency, type Complete } from './idempotency';

const request = (key: string) => new Request('https://example.test', { method: 'POST', headers: { 'Idempotency-Key': key } });
const gate = () => { let open!: () => void; const opened = new Promise<void>((resolve) => { open = resolve; }); return { open, opened }; };

// IDEMPOTENCY_INTEGRATION=1 npx vitest run lib/idempotency.integration.test.ts
// Owns a disposable loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.IDEMPOTENCY_INTEGRATION !== '1')('Idempotency-Key claims on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=idempotency_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/idempotency_test` });
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

  it('two simultaneous requests with a new key run the handler once and both get its reply', async () => {
    let runs = 0;
    const handler = async () => { runs += 1; await new Promise((resolve) => setTimeout(resolve, 500)); return reply(201, { run: runs }); };
    const results = await Promise.all([withIdempotency(request('race'), handler), withIdempotency(request('race'), handler)]);
    expect(runs).toBe(1);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(await Promise.all(results.map((r) => r.json()))).toEqual([{ run: 1 }, { run: 1 }]);
    expect(results.map((r) => r.headers.get('Idempotent-Replay')).sort()).toEqual(['true', null].sort());
    expect(await db.botRequest.findUnique({ where: { key: 'race' } })).toMatchObject({ statusCode: 201, body: { run: 1 } });
  });

  it('a request arriving mid-run waits for the first and replays its 4xx', async () => {
    const running = gate(), release = gate();
    let runs = 0;
    const handler = async () => { runs += 1; running.open(); await release.opened; return reply(409, { reason: 'limit', error: 'Too many.' }); };
    const first = withIdempotency(request('midway'), handler);
    await running.opened;
    const second = withIdempotency(request('midway'), handler);
    setTimeout(release.open, 600);
    const [a, b] = await Promise.all([first, second]);
    expect(runs).toBe(1);
    expect([a.status, b.status]).toEqual([409, 409]);
    expect(await b.json()).toEqual({ reason: 'limit', error: 'Too many.' });
    expect(b.headers.get('Idempotent-Replay')).toBe('true');
  });

  it('a first attempt that throws does not block a retry with the same key', async () => {
    await expect(withIdempotency(request('throws'), async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await db.botRequest.findUnique({ where: { key: 'throws' } })).toBeNull();
    const retry = await withIdempotency(request('throws'), async () => reply(200, { ok: true }));
    expect(retry.status).toBe(200);
    expect(retry.headers.get('Idempotent-Replay')).toBeNull();
  });

  it('a claim older than its lifetime does not block a new request, and only one retry takes it over', async () => {
    await db.botRequest.create({ data: { key: 'stale', statusCode: 0, body: {}, createdAt: new Date(Date.now() - CLAIM_LIFETIME_MS - 60_000) } });
    let runs = 0;
    const handler = async () => { runs += 1; await new Promise((resolve) => setTimeout(resolve, 500)); return reply(200, { ok: true }); };
    const results = await Promise.all([withIdempotency(request('stale'), handler), withIdempotency(request('stale'), handler)]);
    expect(runs).toBe(1);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.botRequest.findUnique({ where: { key: 'stale' } })).toMatchObject({ statusCode: 200, body: { ok: true } });
  });

  it('complete commits the reply with the transaction: a late retry replays it, a rolled-back one stores nothing', async () => {
    let runs = 0;
    const handler = (fail: boolean) => async (complete: Complete) => {
      runs += 1;
      return db.$transaction(async (tx) => {
        const r = await complete(tx, reply(201, { run: runs }));
        if (fail) throw new Error('rolled back');
        return r;
      });
    };
    await expect(withIdempotency(request('in-tx'), handler(true))).rejects.toThrow('rolled back');
    expect(await db.botRequest.findUnique({ where: { key: 'in-tx' } })).toBeNull();
    expect((await withIdempotency(request('in-tx'), handler(false))).status).toBe(201);
    await db.botRequest.update({ where: { key: 'in-tx' }, data: { createdAt: new Date(Date.now() - CLAIM_LIFETIME_MS - 60_000) } });
    const late = await withIdempotency(request('in-tx'), handler(false));
    expect([late.status, late.headers.get('Idempotent-Replay'), await late.json()]).toEqual([201, 'true', { run: 2 }]);
    expect(runs).toBe(2);
  });

  it('a waiting request that times out gets 409 in_progress and the handler runs once', async () => {
    const running = gate(), release = gate();
    let runs = 0;
    const handler = async () => { runs += 1; running.open(); await release.opened; return reply(200, { ok: true }); };
    const first = withIdempotency(request('slow'), handler);
    await running.opened;
    const waited = await withIdempotency(request('slow'), handler);
    expect(waited.status).toBe(409);
    expect(await waited.json()).toEqual({ reason: 'in_progress', error: expect.any(String) });
    release.open();
    expect((await first).status).toBe(200);
    expect(runs).toBe(1);
    const replay = await withIdempotency(request('slow'), handler);
    expect(replay.headers.get('Idempotent-Replay')).toBe('true');
  }, WAIT_MS + 10_000);
});
