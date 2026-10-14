import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const holder = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return holder.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
vi.mock('@/lib/users', () => ({ ensureUser: async () => ({ id: 'u_rae' }) }));
import { POST } from './route';

// The worked example of ADDON-SPEC.md section 12 (sample data).
const RAID = 'cm9xr2k4a0001';
const EXAMPLE = [
  `BFOUT1;${RAID};SA0001;staging`,
  'A;aw-7f3k2m9q;lb_lucifron;16805;Ana Vale;u_ana;HR;91;;Rae Quill;1792001200;',
  'K;cf-1x8p4d2s;aw-7f3k2m9q;1792001204;',
  'A;aw-8d3c5n2a;lb_lucifron;16805;Dee Holt;u_dee;OPEN_ROLL;64;;Rae Quill;1792001230;',
  'V;vd-5b2n8c1w;aw-8d3c5n2a;wrong winner;1792001260;',
  'R;rp-9c4v6t0e;aw-7f3k2m9q;1792001300;;aw-2h6j9z4b;lb_lucifron;16805;Bo Marsh;u_bo;SR;77;;Rae Quill;1792001300',
  'E;5',
].join('\n');
const importText = (text: string) => POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ text }) }), { params: Promise.resolve({ id: RAID }) });

// IMPORT_INTEGRATION=1 npx vitest run 'app/api/raids/[id]/loot/import/route.integration.test.ts'
// Owns a new loopback-only database; never connects to existing data or a settings file.
describe.skipIf(process.env.IMPORT_INTEGRATION !== '1')('importing copy-out text on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const statuses = async (text: string) => ((await (await importText(text)).json()).results as { status: string; code?: string }[]).map((r) => r.code ?? r.status);
  const addDee = () => db.user.create({ data: { id: 'u_dee', discordId: 'd-dee', discordName: 'dee', characters: { create: { name: 'Dee Holt', class: 'MAGE', spec: 'Fire', raidRole: 'RANGED' } } } });
  const stored = async () => ({ awards: await db.lootAward.count(), operations: await db.lootOperation.count() });

  beforeAll(async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'staging');
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=import_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/import_test` });
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
    vi.unstubAllEnvs();
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(async () => {
    await db.lootOperationRejection.deleteMany();
    await db.lootOperation.deleteMany();
    await db.lootAward.deleteMany();
    await db.raid.deleteMany();
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.user.deleteMany();
    await db.lootItem.create({ data: { id: 16805, name: 'Item', quality: 4, icon: 'sample', tooltipHtml: '', source: 'CLASSIC', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'tier', short: 'tier', size: 40, requirements: {}, durationMin: 180,
      lootBosses: { create: { id: 'lb_lucifron', name: 'Lucifron', position: 0, entries: { create: { itemId: 16805, position: 0 } } } },
    } });
    await db.raid.create({ data: { id: RAID, name: 'Raid', startsAt: new Date(), locksAt: new Date(), requirements: {}, templateId: 'tier' } });
    // Dee Holt is not a known character.
    for (const [user, name] of [['u_ana', 'Ana Vale'], ['u_bo', 'Bo Marsh'], ['u_rae', 'Rae Quill']]) {
      await db.user.create({ data: { id: user, discordId: `d-${user}`, discordName: user, characters: { create: { name, class: 'MAGE', spec: 'Fire', raidRole: 'RANGED' } } } });
    }
  });

  it('records the worked example, and an unknown name comes back unknown-character', async () => {
    const res = await importText(EXAMPLE);
    expect(res.status).toBe(200);
    const { results } = await res.json();
    // Dee is unknown, so her award is refused and her void is held with nothing to void.
    expect(results.map((r: { status: string; code?: string }) => r.code ?? r.status)).toEqual(['recorded', 'recorded', 'unknown-character', 'pending', 'recorded']);
    expect(results[0]).toMatchObject({ type: 'award', item: 16805, character: 'Ana Vale' });
    expect(await db.lootAward.findMany({ orderBy: { requestKey: 'asc' }, select: { requestKey: true, characterName: true, voidedAt: true, confirmation: true } })).toMatchObject([
      { requestKey: 'aw-2h6j9z4b', characterName: 'Bo Marsh', voidedAt: null },
      { requestKey: 'aw-7f3k2m9q', characterName: 'Ana Vale', confirmation: 'CONFIRMED', voidedAt: expect.any(Date) },
    ]);
  });

  it('records Dee\'s award then voids it when she is a known character', async () => {
    await addDee();
    expect(await statuses(EXAMPLE)).toEqual(['recorded', 'recorded', 'recorded', 'voided', 'recorded']);
  });

  it('changes nothing the second time', async () => {
    await addDee();
    await importText(EXAMPLE);
    const before = await stored();
    expect(await statuses(EXAMPLE)).toEqual(Array(5).fill('replayed'));
    expect(await stored()).toEqual(before);
  });

  it('records nothing from a rejected paste', async () => {
    for (const text of [EXAMPLE.replace('E;5', 'E;4'), EXAMPLE.replace('staging', 'production'), EXAMPLE.split('\n').slice(0, -1).join('\n'), EXAMPLE.replace('K;cf-1x8p4d2s;', 'K;')]) {
      expect((await importText(text)).status).toBe(400);
    }
    expect(await stored()).toEqual({ awards: 0, operations: 0 });
  });

  it('applies 250 operations in batches and answers each; a malformed line 230 records nothing', async () => {
    const award = (n: number) => `A;aw-${String(n).padStart(8, '0')};lb_lucifron;16805;Ana Vale;u_ana;HR;91;;Rae Quill;${1792001200 + n};`;
    const lines = Array.from({ length: 250 }, (_, i) => award(i + 1));
    const text = (ls: string[]) => [EXAMPLE.split('\n')[0], ...ls, `E;${ls.length}`].join('\n');
    const bad = await importText(text(lines.map((l, i) => (i === 228 ? 'garbage' : l))));
    expect(await bad.json()).toMatchObject({ code: 'malformed-line', line: 230 });
    expect(await stored()).toEqual({ awards: 0, operations: 0 });
    const statusList = await statuses(text(lines));
    expect(statusList).toEqual(Array(250).fill('recorded'));
    expect((await stored()).awards).toBe(250);
  });
});
