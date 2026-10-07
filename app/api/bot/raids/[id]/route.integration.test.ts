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
import { POST } from './respond/route';
import { POST as BENCH } from './bench/route';
import { REASONS } from '@/lib/signup-rules';

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
    await client.user.create({ data: { id: 'u1', discordId: ME, discordName: 'Sample one', role: 'MEMBER', characters: { create: { id: 'c1', name: 'Sampleone', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED', isMain: true } } } });
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
      character: { id: 'c1', name: 'Sampleone', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged' },
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

  const answer = (id: string, body: object = {}, key?: string, bench = false) => (bench ? BENCH : POST)(new Request(`http://localhost/api/bot/raids/${id}/${bench ? 'bench' : 'respond'}`, {
    method: 'POST', headers: { authorization: `Bearer ${SECRET}`, ...(key ? { 'Idempotency-Key': key } : {}) },
    body: JSON.stringify({ discordId: ME, response: 'ACCEPT', ...body }),
  }), { params: Promise.resolve({ id }) });
  const saved = (raidId: string) => client.signup.findUniqueOrThrow({ where: { raidId_userId: { raidId, userId: 'u1' } } });
  const fresh = (id: string) => client.raid.create({ data: { id, name: id, templateId: 't-table', startsAt: new Date('2099-06-01'), locksAt: new Date('2099-06-01'), requirements: {}, discordThreadId: `${id}-thread` } });

  it('creates with the main, preserves a saved choice when omitted, and exposes alts only to their viewer', async () => {
    await fresh('choice');
    const first = await answer('choice');
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ removedReserves: [], viewer: { character: { id: 'c1' } } });
    expect((await saved('choice')).characterId).toBe('c1');
    expect(await viewer('choice')).not.toHaveProperty('characters');
    await client.character.create({ data: { id: 'alt', userId: 'u1', name: 'Altone', isMain: false, class: 'PRIEST', spec: 'Holy', raidRole: 'HEALER' } });
    const selected = await answer('choice', { characterId: 'alt' });
    expect(selected.status).toBe(200);
    expect(await selected.json()).toMatchObject({ removedReserves: [], viewer: {
      character: { id: 'alt', name: 'Altone', wowClass: 'priest', spec: 'Holy', raidRole: 'healer' },
      characters: [{ id: 'c1', isMain: true }, { id: 'alt', isMain: false }],
    } });
    expect((await answer('choice', { response: 'TENTATIVE' })).status).toBe(200);
    expect((await saved('choice')).characterId).toBe('alt');
    expect((await viewer('choice')).character.id).toBe('alt');
    expect(await viewer('choice', '100000000000000009')).toBeNull();
    await fresh('new-alt');
    expect((await answer('new-alt', { characterId: 'alt' })).status).toBe(200);
    expect((await saved('new-alt')).characterId).toBe('alt');
  });

  it.each([null, '', '   ', 42, {}, 'foreign'])('rejects invalid or foreign character %j without writing', async (characterId) => {
    if (characterId === 'foreign') await client.user.create({ data: { id: 'stranger', discordId: '100000000000000002', discordName: 'Sample stranger', characters: { create: { id: 'foreign', name: 'Foreign', class: 'MAGE', spec: 'Frost', raidRole: 'RANGED' } } } });
    const before = await saved('choice');
    expect((await answer('choice', { characterId })).status).toBe(400);
    expect(await saved('choice')).toEqual(before);
  });
  it.each(['ABSENT', 'decline'])('rejects a character with %s but accepts an absent answer without one', async (response) => {
    await client.signup.update({ where: { raidId_userId: { raidId: 'choice', userId: 'u1' } }, data: { standing: 'ROSTER' } });
    expect((await answer('choice', { response, characterId: 'alt' })).status).toBe(400);
    expect((await answer('choice', { response, reason: 'Away' })).status).toBe(200);
    expect(await saved('choice')).toMatchObject({ response: 'ABSENT', reason: 'Away', characterId: 'alt' });
  });

  it('answers before switching, removes incompatible reserves, and replays the complete reply', async () => {
    await fresh('removals');
    await client.signup.create({ data: { raidId: 'removals', userId: 'u1', characterId: 'c1', response: 'ABSENT', source: 'WEB' } });
    for (const [itemId, kind] of [[100, 'HR'], [101, 'SR']] as const) await client.reserve.create({ data: { raidId: 'removals', userId: 'u1', characterId: 'c1', itemId, kind } });
    await client.lootReserveSetting.create({ data: { templateId: 't-table', itemId: 100, blocked: true } });
    const res = await answer('removals', { characterId: 'alt' }, 'choose-alt');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removedReserves).toEqual([{ kind: 'HR', itemName: 'Item 100', reason: 'Not open to reserves' }]);
    expect(body.viewer.character.id).toBe('alt');
    expect(body.bars).toEqual({ tank: 0, healer: 1, melee: 0, ranged: 0 });
    expect(await saved('removals')).toMatchObject({ characterId: 'alt', response: 'ACCEPT', source: 'DISCORD' });
    expect(await client.reserve.findMany({ where: { raidId: 'removals' } })).toMatchObject([{ kind: 'SR', characterId: 'alt' }]);
    const replay = await answer('removals', { characterId: 'alt' }, 'choose-alt');
    expect(replay.headers.get('Idempotent-Replay')).toBe('true');
    expect(await replay.json()).toEqual(body);
    expect((await (await answer('removals', { characterId: 'alt' })).json()).removedReserves).toEqual([]);
  });

  it('rolls the answer and outbox back on a real switch refusal', async () => {
    await fresh('rollback');
    // decideRespond uses the stored status; the shared switch additionally checks cancelledAt.
    await client.raid.update({ where: { id: 'rollback' }, data: { cancelledAt: new Date() } });
    await client.signup.create({ data: { raidId: 'rollback', userId: 'u1', characterId: 'c1', response: 'ABSENT', reason: 'Original', source: 'WEB' } });
    await client.reserve.create({ data: { raidId: 'rollback', userId: 'u1', characterId: 'c1', itemId: 101, kind: 'SR' } });
    const before = await saved('rollback');
    const reserves = await client.reserve.findMany({ where: { raidId: 'rollback' } });
    const jobs = await client.outboxJob.count();
    const res = await answer('rollback', { characterId: 'alt' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ reason: REASONS.cancelled });
    expect(await saved('rollback')).toEqual(before);
    expect(await client.reserve.findMany({ where: { raidId: 'rollback' } })).toEqual(reserves);
    expect(await client.outboxJob.count()).toBe(jobs);
  });

  it.each(['locked', 'CANCELLED', 'DONE'] as const)('keeps the existing %s response refusal', async (kind) => {
    const id = `refuse-${kind}`;
    await fresh(id);
    await client.raid.update({ where: { id }, data: kind === 'locked' ? { locksAt: new Date(0) } : { status: kind } });
    const res = await answer(id, { characterId: 'alt' });
    expect(res.status).toBe(409);
    expect(await client.signup.count({ where: { raidId: id } })).toBe(0);
  });
  it('leaves bench character choice untouched and supports a viewer with no character', async () => {
    await fresh('bench');
    expect((await answer('bench', { characterId: 'alt' }, undefined, true)).status).toBe(200);
    expect((await saved('bench')).characterId).toBe('c1');
    await client.user.create({ data: { id: 'empty', discordId: '100000000000000003', discordName: 'Sample empty', role: 'MEMBER' } });
    const res = await answer('bench', { discordId: '100000000000000003' });
    expect(res.status).toBe(200);
    expect((await res.json()).viewer).toMatchObject({ character: null });
    expect(await viewer('bench', '100000000000000003')).not.toHaveProperty('characters');
  });
});
