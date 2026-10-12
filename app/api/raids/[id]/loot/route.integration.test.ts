import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, beforeSave: null as null | (() => Promise<unknown>) }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ role: 'officer' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
// Runs after the Wowhead lookup and just before the transaction, so a test can break the save.
vi.mock('@/lib/users', () => ({ ensureUser: async () => { await state.beforeSave?.(); return { id: 'officer-user' }; } }));
import { POST } from './route';
import { GET as lookup } from './lookup/route';

const BRACERS = { name: 'Whelp-Scale Bracers of the Brood Mother', quality: 4, icon: 'inv_bracer_13', tooltip: '<b>Bracers</b>' };
const wowhead = vi.fn();
const UNLISTED = { bossId: 'boss', itemRef: 'https://www.wowhead.com/forever/item=231044', characterId: 'char', method: 'OPEN_ROLL', requestKey: 'submission-1' };
const record = (body: unknown) => POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'raid' }) });

// UNLISTED_DROP_INTEGRATION=1 npx vitest run 'app/api/raids/[id]/loot/route.integration.test.ts'
// Owns a disposable loopback-only database; never uses an existing database or settings file.
describe.skipIf(process.env.UNLISTED_DROP_INTEGRATION !== '1')('recording an unlisted drop on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=unlisted_drop_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/unlisted_drop_test` });
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
    vi.stubGlobal('fetch', wowhead);
  }, 120_000);
  afterAll(async () => {
    vi.unstubAllGlobals();
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });
  beforeEach(async () => {
    state.beforeSave = null;
    wowhead.mockReset().mockImplementation(async () => new Response(JSON.stringify(BRACERS), { status: 200 }));
    await db.lootAward.deleteMany();
    await db.raid.deleteMany();
    await db.user.deleteMany();
    await db.raidTemplate.deleteMany();
    await db.lootItem.deleteMany();
    await db.lootItem.create({ data: { id: 1, name: 'Item 1', quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() } });
    await db.raidTemplate.create({ data: {
      id: 'tier', name: 'Tier', short: 'T', size: 40, requirements: {}, durationMin: 180,
      lootBosses: { create: { id: 'boss', name: 'Boss', position: 0, entries: { create: { itemId: 1, position: 0 } } } },
    } });
    await db.raid.create({ data: { id: 'raid', name: 'Raid', startsAt: new Date(), locksAt: new Date(), requirements: {}, templateId: 'tier' } });
    await db.user.create({ data: { id: 'user', discordId: '1', discordName: 'notary', characters: { create: { id: 'char', name: 'Notary', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' } } } });
  });

  const saved = async () => ({
    items: await db.lootItem.count({ where: { id: 231044 } }),
    entries: await db.lootTableEntry.findMany({ where: { itemId: 231044 }, select: { bossId: true, position: true } }),
    awards: await db.lootAward.count({ where: { itemId: 231044 } }),
  });

  it('adds the item to the boss’s table and records it', async () => {
    const res = await record(UNLISTED);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ addedToTable: true });
    expect(await saved()).toEqual({ items: 1, entries: [{ bossId: 'boss', position: 1 }], awards: 1 });
  });

  it('leaves no item or table entry behind when the award can’t be saved', async () => {
    // The winner's character disappears between the checks and the save: the award insert fails.
    state.beforeSave = () => db.character.delete({ where: { id: 'char' } });
    const res = await record(UNLISTED);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Something changed while it was saving, so nothing was saved. Try again.' });
    expect(await saved()).toEqual({ items: 0, entries: [], awards: 0 });
  });

  it('saves nothing when Wowhead has no such item', async () => {
    wowhead.mockImplementation(async () => new Response(JSON.stringify({ error: 'Entity not found' }), { status: 404 }));
    expect((await record(UNLISTED)).status).toBe(404);
    expect(await saved()).toEqual({ items: 0, entries: [], awards: 0 });
  });

  it('records two simultaneous retries of one submission once, and a second submission again', async () => {
    const [a, b] = await Promise.all([record(UNLISTED), record(UNLISTED)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(await saved()).toEqual({ items: 1, entries: [{ bossId: 'boss', position: 1 }], awards: 1 });
    const second = await record({ ...UNLISTED, requestKey: 'submission-2' });
    expect(await second.json()).toMatchObject({ addedToTable: false });
    expect(await saved()).toEqual({ items: 1, entries: [{ bossId: 'boss', position: 1 }], awards: 2 });
  }, 15_000);

  it('lookup saves nothing, then reports the item as on the table once recorded', async () => {
    const find = () => lookup(new Request('https://example.test/x?item=231044'), { params: Promise.resolve({ id: 'raid' }) });
    expect(await (await find()).json()).toMatchObject({ item: { id: 231044 }, onTable: [] });
    expect(await saved()).toEqual({ items: 0, entries: [], awards: 0 });
    await record(UNLISTED);
    expect(await (await find()).json()).toMatchObject({ item: { id: 231044 }, onTable: [{ bossId: 'boss', bossName: 'Boss' }] });
  });

  it('keeps existing awards without a key, any number of them', async () => {
    await db.lootAward.createMany({ data: [1, 2].map(() => ({ raidId: 'raid', itemId: 1, method: 'DISENCHANT_BANK' as const, recordedById: 'officer-user' })) });
    expect(await db.lootAward.count({ where: { requestKey: null } })).toBe(2);
  });
});
