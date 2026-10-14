import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import type { Session } from '@/lib/session';
const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
import { createHelperKey, hashHelperKey, listHelperKeys, recordHelperKeyUse, revokeHelperKey, verifyHelperKey } from './helper-keys';

// HELPER_KEYS_INTEGRATION=1 npx vitest run lib/helper-keys.integration.test.ts
// Owns a new loopback-only database; never connects to existing data or a settings file.
describe.skipIf(process.env.HELPER_KEYS_INTEGRATION !== '1')('helper keys on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient, url: string;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const officer = (discordId: string) => ({ discordId, role: 'officer', name: `Sample ${discordId}` }) as Session;
  const make = async (who: Session, name: string) => {
    const made = await createHelperKey(who, name);
    if (!made.ok) throw new Error(made.error);
    return made;
  };
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=helper_keys_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    url = `postgresql://worker:worker@${binding}/helper_keys_test`;
    pool = new Pool({ connectionString: url });
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
    await db.helperKey.deleteMany(); await db.user.deleteMany();
  });

  it('leaves no drift between the migrations and the schema', () => {
    // Exit code 2 (a difference) throws; 0 means in step.
    execFileSync('npx', ['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'], {
      env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url }, stdio: 'pipe', timeout: 60_000,
    });
  }, 60_000);

  it('stores only the hash: no column holds the plain key', async () => {
    const made = await make(officer('a'), 'Raid laptop');
    const { rows: columns } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'HelperKey' ORDER BY ordinal_position`);
    expect(columns.map((c) => c.column_name)).toEqual(['id', 'userId', 'name', 'keyHash', 'createdAt', 'lastUsedAt', 'revokedAt']);
    const { rows } = await pool.query('SELECT * FROM "HelperKey"');
    expect(rows).toHaveLength(1);
    expect(rows[0].keyHash).toBe(hashHelperKey(made.key));
    expect(JSON.stringify(rows)).not.toContain(made.key.slice(4));
  });

  it('verifies a live key, records its use, and refuses it once revoked', async () => {
    const made = await make(officer('a'), 'Raid laptop');
    const owner = await db.user.findUniqueOrThrow({ where: { discordId: 'a' } });
    const verified = await verifyHelperKey(made.key);
    expect(verified).toEqual({ ok: true, userId: owner.id, keyId: made.id });
    const at = new Date('2026-10-14T13:00:00Z');
    await recordHelperKeyUse(made.id, at);
    expect(await listHelperKeys(officer('a'))).toEqual({ ok: true, keys: [{ id: made.id, name: 'Raid laptop', createdAt: made.createdAt, lastUsedAt: at }] });
    expect(await verifyHelperKey(`${made.key.slice(0, -1)}${made.key.endsWith('A') ? 'B' : 'A'}`)).toEqual({ ok: false, status: 401 });
    expect(await revokeHelperKey(officer('a'), made.id)).toEqual({ ok: true });
    expect(await verifyHelperKey(made.key)).toEqual({ ok: false, status: 401 });
    expect(await revokeHelperKey(officer('a'), made.id)).toMatchObject({ ok: false, status: 404 });
    await recordHelperKeyUse(made.id, new Date('2026-10-15T00:00:00Z'));
    expect(await db.helperKey.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({ lastUsedAt: at, revokedAt: expect.any(Date) });
  });

  it('follows the owner’s stored role on each call', async () => {
    const made = await make(officer('a'), 'Raid laptop');
    for (const [role, expected] of [['MEMBER', 403], ['SOCIAL', 403], ['OFFICER', 200]] as const) {
      await db.user.update({ where: { discordId: 'a' }, data: { role } });
      const result = await verifyHelperKey(made.key);
      expect(result.ok ? 200 : result.status).toBe(expected);
    }
    await db.user.delete({ where: { discordId: 'a' } });
    expect(await verifyHelperKey(made.key)).toEqual({ ok: false, status: 401 });
  });

  it('keeps each officer to their own keys', async () => {
    const mine = await make(officer('a'), 'Laptop');
    const second = await make(officer('a'), 'Desktop');
    const theirs = await make(officer('b'), 'Theirs');
    expect(await revokeHelperKey(officer('a'), theirs.id)).toMatchObject({ ok: false, status: 404 });
    expect(await revokeHelperKey(officer('a'), 'unknown')).toMatchObject({ ok: false, status: 404 });
    expect(await verifyHelperKey(theirs.key)).toMatchObject({ ok: true });
    await revokeHelperKey(officer('a'), second.id);
    const listed = await listHelperKeys(officer('a'));
    expect(listed.ok && listed.keys.map((k) => k.id)).toEqual([mine.id]);
    expect(await db.helperKey.count()).toBe(3);
  });
});
