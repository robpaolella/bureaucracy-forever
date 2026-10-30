import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
vi.mock('@/lib/flags', () => ({ helperEnabled: () => true }));
import { hashHelperKey } from '@/lib/helper-keys';
import { POST } from './route';

// The worked examples of ADDON-SPEC.md section 4.3 (sample data).
const RAID = 'cm9xr2k4a0001';
const KEY = `bfh_${'r'.repeat(43)}`;
const records = (env: 'staging' | 'production') => {
  const common = { formatVersion: 1, raid: RAID, env };
  const award = { type: 'award', id: 'aw-7f3k2m9q', ...common, boss: 'lb_lucifron', item: 16805, char: 'Ana Vale', user: 'u_ana', method: 'HR', roll: 91, sender: 'Rae Quill', at: 1792001200 };
  return {
    award,
    confirm: { type: 'confirm', id: 'cf-1x8p4d2s', ...common, key: award.id, at: 1792001204 },
    void: { type: 'void', id: 'vd-5b2n8c1w', ...common, key: award.id, reason: 'wrong winner', at: 1792001260 },
    practice: { type: 'award', id: 'aw-4t1y7g5k', ...common, practice: true, boss: 'lb_lucifron', item: 16805, char: 'Bo Marsh', method: 'OPEN_ROLL', roll: 12, sender: 'Rae Quill', at: 1792001400 },
  };
};
let ip = 0;
const upload = (operations: unknown[]) => POST(new Request('https://example.test/api/helper/operations', {
  method: 'POST',
  headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json', 'x-real-ip': `192.0.2.${++ip}` },
  body: JSON.stringify({ operations }),
}));
const results = async (operations: unknown[]) => {
  const res = await upload(operations);
  expect(res.status).toBe(200);
  return ((await res.json()).results as { id: string; status: string; code?: string }[]).map((r) => [r.id, r.code ?? r.status]);
};

// HELPER_UPLOAD_INTEGRATION=1 npx vitest run app/api/helper/operations/route.integration.test.ts
// Owns a new loopback-only database; never connects to existing data or a settings file.
describe.skipIf(process.env.HELPER_UPLOAD_INTEGRATION !== '1')('the helper upload on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const stored = async () => ({ awards: await db.lootAward.count(), operations: await db.lootOperation.count() });
  const staging = () => { vi.stubEnv('VERCEL_ENV', 'preview'); vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'staging'); };

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=helper_upload_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/helper_upload_test` });
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
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(async () => {
    await db.lootOperationRejection.deleteMany();
    await db.lootOperation.deleteMany();
    await db.lootAward.deleteMany();
    await db.helperKey.deleteMany();
    await db.raid.deleteMany();
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.user.deleteMany();
    await db.lootItem.create({ data: { id: 16805, name: 'Item 16805', quality: 4, icon: 'sample', tooltipHtml: '', source: 'CLASSIC', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'tier', short: 'tier', size: 40, requirements: {}, durationMin: 180,
      lootBosses: { create: { id: 'lb_lucifron', name: 'Lucifron', position: 0, entries: { create: { itemId: 16805, position: 0 } } } },
    } });
    await db.raid.create({ data: { id: RAID, name: 'Raid', startsAt: new Date(), locksAt: new Date(), requirements: {}, templateId: 'tier' } });
    for (const [user, name] of [['u_ana', 'Ana Vale'], ['u_bo', 'Bo Marsh'], ['u_rae', 'Rae Quill']]) {
      await db.user.create({ data: { id: user, discordId: `d-${user}`, discordName: user, characters: { create: { name, class: 'MAGE', spec: 'Fire', raidRole: 'RANGED' } } } });
    }
    await db.user.update({ where: { id: 'u_rae' }, data: { role: 'OFFICER' } });
    await db.helperKey.create({ data: { userId: 'u_rae', name: 'Laptop', keyHash: hashHelperKey(KEY) } });
  });

  it('records an upload sent twice once, and acknowledges both times', async () => {
    staging();
    const r = records('staging');
    const batch = [r.award, r.confirm];
    expect(await results(batch)).toEqual([['aw-7f3k2m9q', 'recorded'], ['cf-1x8p4d2s', 'recorded']]);
    const before = await stored();
    expect(before).toEqual({ awards: 1, operations: 2 });
    expect(await results(batch)).toEqual([['aw-7f3k2m9q', 'replayed'], ['cf-1x8p4d2s', 'replayed']]);
    expect(await stored()).toEqual(before);
    expect(await db.lootAward.findUniqueOrThrow({ where: { requestKey: 'aw-7f3k2m9q' } })).toMatchObject({ confirmation: 'CONFIRMED', voidedAt: null });
  });

  it('holds a void sent before its award, then records the award void', async () => {
    staging();
    const r = records('staging');
    expect(await results([r.void, r.award])).toEqual([['vd-5b2n8c1w', 'pending'], ['aw-7f3k2m9q', 'voided']]);
    expect(await db.lootAward.findUniqueOrThrow({ where: { requestKey: 'aw-7f3k2m9q' } })).toMatchObject({ voidedAt: expect.any(Date), voidReason: 'wrong winner', voidedById: 'u_rae' });
  });

  it('records the key’s officer as the one who delivered each award', async () => {
    staging();
    const r = records('staging');
    await results([r.award, r.practice]);
    expect(await db.lootAward.findMany({ orderBy: { requestKey: 'asc' }, select: { requestKey: true, recordedById: true, deliveredVia: true, practice: true } })).toEqual([
      { requestKey: 'aw-4t1y7g5k', recordedById: 'u_rae', deliveredVia: 'HELPER', practice: true },
      { requestKey: 'aw-7f3k2m9q', recordedById: 'u_rae', deliveredVia: 'HELPER', practice: false },
    ]);
    expect(await db.lootOperation.findMany({ select: { deliveredById: true } })).toEqual([{ deliveredById: 'u_rae' }, { deliveredById: 'u_rae' }]);
  });

  it('refuses practice records in production and still records the rest', async () => {
    const r = records('production');
    expect(await results([r.practice, r.award])).toEqual([['aw-4t1y7g5k', 'practice-refused'], ['aw-7f3k2m9q', 'recorded']]);
    expect(await db.lootAward.findMany({ select: { requestKey: true } })).toEqual([{ requestKey: 'aw-7f3k2m9q' }]);
    expect(await db.lootOperationRejection.findMany({ select: { opId: true, code: true, deliveredById: true } })).toEqual([{ opId: 'aw-4t1y7g5k', code: 'practice-refused', deliveredById: 'u_rae' }]);
  });

  it('answers records for the other site, an unknown raid and unreadable ones alone', async () => {
    staging();
    const r = records('staging');
    expect(await results([records('production').award, { ...r.confirm, raid: 'cm-not-a-raid' }, { ...r.award, item: 'x' }, r.award])).toEqual([
      ['aw-7f3k2m9q', 'wrong-environment'], ['cf-1x8p4d2s', 'unknown-raid'], ['aw-7f3k2m9q', 'bad-record'], ['aw-7f3k2m9q', 'recorded'],
    ]);
  });

  it('refuses an award whose sender isn’t a current officer’s character, keeping it as a problem', async () => {
    staging();
    const r = records('staging');
    expect(await results([{ ...r.award, sender: 'Ana Vale' }])).toEqual([['aw-7f3k2m9q', 'unknown-sender']]);
    expect(await stored()).toEqual({ awards: 0, operations: 0 });
    expect(await db.lootOperationRejection.findMany({ select: { opId: true, code: true, deliveredById: true } })).toEqual([{ opId: 'aw-7f3k2m9q', code: 'unknown-sender', deliveredById: 'u_rae' }]);
  });

  it('refuses a key whose owner is no longer an officer, recording nothing', async () => {
    staging();
    await db.user.update({ where: { id: 'u_rae' }, data: { role: 'MEMBER' } });
    expect((await upload([records('staging').award])).status).toBe(403);
    expect(await stored()).toEqual({ awards: 0, operations: 0 });
  });
});
