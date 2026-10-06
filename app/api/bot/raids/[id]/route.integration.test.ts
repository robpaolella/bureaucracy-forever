import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

// Opt-in real PostgreSQL proof of the viewer's reserve fields. Owns a fresh loopback-only container, never an existing DB.
// RAID_VIEW_INTEGRATION=1 npx vitest run 'app/api/bot/raids/[id]/route.integration.test.ts'
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, loot: true }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => state.loot }));
import { GET } from './route';

const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
const HOUR = 60 * 60_000;
const SECRET = 'raid-view-test-secret';
const ME = '100000000000000001';
const viewer = async (raidId: string, discordId = ME) => {
  const res = await GET(new Request(`http://localhost/api/bot/raids/${raidId}?discordId=${discordId}`, { headers: { authorization: `Bearer ${SECRET}` } }), { params: Promise.resolve({ id: raidId }) });
  expect(res.status).toBe(200);
  return (await res.json()).viewer;
};

// All data is synthetic; the database and container are created and removed by this suite.
describe.skipIf(process.env.RAID_VIEW_INTEGRATION !== '1')('GET /api/bot/raids/:id viewer reserves on real PostgreSQL', () => {
  let container: string;
  let pool: Pool;
  let client: PrismaClient;

  beforeAll(async () => {
    process.env.BOT_SHARED_SECRET = SECRET;
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=raid_view_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/raid_view_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    }
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    state.db = client;
    await client.raidTemplate.create({ data: { id: 't-table', name: 'With table', short: 'WT', size: 10, requirements: {} } });
    await client.raidTemplate.create({ data: { id: 't-empty', name: 'No table', short: 'NT', size: 10, requirements: {} } });
    await client.user.create({ data: { id: 'u1', discordId: ME, discordName: 'Sample one', characters: { create: { id: 'c1', name: 'Sampleone', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED', isMain: true } } } });
    const startsAt = new Date(Date.now() + 72 * HOUR);
    for (const [id, templateId, at] of [['r-one', 't-table', startsAt], ['r-two', 't-table', startsAt], ['r-empty', 't-empty', startsAt], ['r-locked', 't-table', new Date(Date.now() + HOUR)]] as const) {
      await client.raid.create({ data: { id, name: `Raid ${id}`, templateId, startsAt: at, locksAt: at, requirements: {}, signups: { create: { userId: 'u1', response: 'ACCEPT', source: 'WEB' } } } });
    }
    await client.raid.create({ data: { id: 'r-unsigned', name: 'Raid unsigned', templateId: 't-table', startsAt, locksAt: startsAt, requirements: {} } });
    for (const id of [100, 101]) await client.lootItem.create({ data: { id, name: `Item ${id}`, quality: 4, icon: '', tooltipHtml: '', source: 'CLASSIC', fetchedAt: new Date() } });
    await client.lootBoss.create({ data: { templateId: 't-table', name: 'Sample boss', position: 0, entries: { create: [{ itemId: 100, position: 0 }, { itemId: 101, position: 1 }] } } });
    // A hard reserve on r-one, and a soft reserve only on r-two: neither raid is complete.
    await client.reserve.create({ data: { raidId: 'r-one', userId: 'u1', characterId: 'c1', itemId: 100, kind: 'HR' } });
    await client.reserve.create({ data: { raidId: 'r-two', userId: 'u1', characterId: 'c1', itemId: 101, kind: 'SR' } });
  }, 120_000);

  afterAll(async () => {
    await client?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });

  it("counts only this raid's reserves, and is complete with both", async () => {
    expect(await viewer('r-one')).toEqual({
      standing: 'ROSTER',
      response: 'accept',
      lootTable: true,
      reservesLocked: false,
      reservesComplete: false,
      reservesUrl: 'https://www.bureauguild.com/members/calendar/r-one?reserves=1',
    });
    expect((await viewer('r-two')).reservesComplete).toBe(false);
    await client.reserve.create({ data: { raidId: 'r-one', userId: 'u1', characterId: 'c1', itemId: 101, kind: 'SR' } });
    expect((await viewer('r-one')).reservesComplete).toBe(true);
  });

  it('has no loot table for an empty tier or while loot is off, and locks at the reserve lock', async () => {
    expect((await viewer('r-empty')).lootTable).toBe(false);
    state.loot = false;
    try {
      expect((await viewer('r-one')).lootTable).toBe(false);
    } finally {
      state.loot = true;
    }
    expect((await viewer('r-locked')).reservesLocked).toBe(true);
  });

  it('gives no viewer to a member without a sign-up', async () => {
    expect(await viewer('r-unsigned')).toBeNull();
  });
});
