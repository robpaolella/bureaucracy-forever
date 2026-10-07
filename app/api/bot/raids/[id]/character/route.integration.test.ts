import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => true }));
import { PUT } from './route';
import { REASONS } from '@/lib/signup-rules';
import { REASONS as LOOT_REASONS } from '@/lib/loot-rules';

// BOT_CHARACTER_INTEGRATION=1 npx vitest run app/api/bot/raids/\[id\]/character/route.integration.test.ts
// Owns a fresh loopback-only PostgreSQL container, never uses an existing database.
describe.skipIf(process.env.BOT_CHARACTER_INTEGRATION !== '1')('bot character switches on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const discordId = '100000000000000001';
  const secret = 'bot-character-test-secret';
  const request = (body: unknown = { discordId, characterId: 'alt' }, options: { id?: string; key?: string; secret?: string; raw?: string } = {}) => PUT(new Request('http://localhost/api/bot/raids/raid/character', {
    method: 'PUT', headers: { authorization: `Bearer ${options.secret ?? secret}`, ...(options.key ? { 'Idempotency-Key': options.key } : {}) },
    body: options.raw ?? JSON.stringify(body),
  }), { params: Promise.resolve({ id: options.id ?? 'raid' }) });
  const snapshot = async () => ({ signup: await db.signup.findMany(), reserves: await db.reserve.findMany(), jobs: await db.outboxJob.findMany() });

  beforeAll(async () => {
    vi.stubEnv('BOT_SHARED_SECRET', secret);
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=bot_character_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/bot_character_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      await pool.query(readFileSync(`prisma/migrations/${folder}/migration.sql`, 'utf8'));
    }
    db = new PrismaClient({ adapter: new PrismaPg(pool) }); state.db = db;
  }, 120_000);
  afterAll(async () => { vi.unstubAllEnvs(); await db?.$disconnect(); await pool?.end(); if (container) docker('stop', container); });
  beforeEach(async () => {
    await pool.query('TRUNCATE "User", "Raid", "RaidTemplate", "LootItem", "OutboxJob", "BotRequest" CASCADE');
    await db.user.create({ data: { id: 'member', discordId, discordName: 'Sample', role: 'MEMBER' } });
    await db.user.create({ data: { id: 'stranger', discordId: '100000000000000002', discordName: 'Other', role: 'MEMBER' } });
    for (const [id, userId, isMain, raidRole] of [['main', 'member', true, 'TANK'], ['alt', 'member', false, 'HEALER'], ['foreign', 'stranger', true, 'TANK']] as const) {
      await db.character.create({ data: { id, userId, name: id, isMain, raidRole, class: 'WARRIOR', spec: 'Sample' } });
    }
    await db.raidTemplate.create({ data: { id: 'tier', name: 'Sample tier', short: 'S', size: 10, requirements: {} } });
    for (const id of ['raid', 'other']) await db.raid.create({ data: { id, name: id, startsAt: new Date('2099-06-01'), locksAt: new Date('2099-06-01'), templateId: 'tier', requirements: {}, discordThreadId: `${id}-thread` } });
    await db.signup.create({ data: { id: 'signup', raidId: 'raid', userId: 'member', characterId: 'main', response: 'ACCEPT', source: 'WEB' } });
    await db.lootBoss.create({ data: { id: 'boss', templateId: 'tier', name: 'Sample boss', position: 0 } });
    for (const id of [1, 2]) {
      await db.lootItem.create({ data: { id, name: `Item ${id}`, source: 'CLASSIC', quality: 4, icon: 'sample', tooltipHtml: '', fetchedAt: new Date() } });
      await db.lootTableEntry.create({ data: { bossId: 'boss', itemId: id, position: id } });
      await db.reserve.create({ data: { raidId: 'raid', userId: 'member', characterId: 'main', itemId: id, kind: id === 1 ? 'HR' : 'SR' } });
    }
  });

  it.each(['ACCEPT', 'TENTATIVE'] as const)('switches a %s signup and moves reserves before the sign-up lock', async (response) => {
    await db.signup.update({ where: { id: 'signup' }, data: { response } });
    // Reserve lock is already past, but the later sign-up lock governs this route.
    await db.raid.update({ where: { id: 'raid' }, data: { startsAt: new Date(Date.now() + 3600_000) } });
    const res = await request();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ character: { id: 'alt', name: 'alt', wowClass: 'warrior', spec: 'Sample', raidRole: 'healer' }, removedReserves: [] });
    expect(await db.signup.findUnique({ where: { id: 'signup' } })).toMatchObject({ characterId: 'alt', response });
    expect((await db.reserve.findMany()).map((r) => r.characterId)).toEqual(['alt', 'alt']);
  });
  it('reports removed reserves without item ids and replays the complete original reply', async () => {
    await db.lootAward.create({ data: { raidId: 'other', itemId: 1, characterId: 'alt', characterName: 'alt', method: 'HR', recordedById: 'stranger' } });
    await db.lootReserveSetting.create({ data: { templateId: 'tier', itemId: 2, blocked: true } });
    const res = await request(undefined, { key: 'switch' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removedReserves).toEqual([
      { kind: 'HR', itemName: 'Item 1', reason: LOOT_REASONS.hrReceived },
      { kind: 'SR', itemName: 'Item 2', reason: LOOT_REASONS.itemBlocked },
    ]);
    expect(await db.reserve.count()).toBe(0);
    const before = await snapshot();
    const replay = await request(undefined, { key: 'switch' });
    expect(replay.headers.get('Idempotent-Replay')).toBe('true');
    expect(await replay.json()).toEqual(body);
    expect(await snapshot()).toEqual(before);
    expect((await (await request()).json()).removedReserves).toEqual([]);
  });
  it.each(['main', null])('same brought character (%s) succeeds after lock without writes', async (characterId) => {
    await db.signup.update({ where: { id: 'signup' }, data: { characterId } });
    await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(0) } });
    const before = await snapshot();
    for (let i = 0; i < 2; i++) {
      const res = await request({ discordId, characterId: 'main' });
      expect(res.status).toBe(200);
      expect((await res.json()).removedReserves).toEqual([]);
    }
    expect(await snapshot()).toEqual(before);
  });
  it.each(['locked', 'officer', 'cancelled', 'done', 'no_signup', 'absent', 'foreign', 'social', 'unknown-member', 'unknown-raid'])('maps %s refusal without writes', async (kind) => {
    if (kind === 'locked' || kind === 'officer') await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(0) } });
    if (kind === 'officer' || kind === 'social') await db.user.update({ where: { id: 'member' }, data: { role: kind === 'officer' ? 'OFFICER' : 'SOCIAL' } });
    if (kind === 'cancelled') await db.raid.update({ where: { id: 'raid' }, data: { cancelledAt: new Date() } });
    if (kind === 'done') await db.raid.update({ where: { id: 'raid' }, data: { startsAt: new Date(0) } });
    if (kind === 'no_signup') await db.signup.deleteMany();
    if (kind === 'absent') await db.signup.update({ where: { id: 'signup' }, data: { response: 'ABSENT' } });
    const before = await snapshot();
    const res = await request({ discordId: kind === 'unknown-member' ? '100000000000000009' : discordId, characterId: kind === 'foreign' ? 'foreign' : 'alt', officerOverride: true }, { id: kind === 'unknown-raid' ? 'missing' : 'raid' });
    const expected: Record<string, [number, object]> = {
      locked: [409, { reason: 'locked', error: REASONS.locked }], officer: [409, { reason: 'locked', error: REASONS.locked }],
      cancelled: [409, { reason: 'cancelled', error: REASONS.cancelled }], done: [409, { reason: 'done', error: REASONS.done }],
      no_signup: [409, { reason: 'no_signup', error: LOOT_REASONS.notEligible }], absent: [409, { reason: 'no_signup', error: LOOT_REASONS.notEligible }],
      foreign: [400, { reason: 'invalid', error: LOOT_REASONS.notYourCharacter }], social: [403, { reason: 'forbidden', error: REASONS.social }],
      'unknown-member': [404, { error: 'Unknown member.' }], 'unknown-raid': [404, { error: 'No such raid.' }],
    };
    expect(res.status).toBe(expected[kind][0]); expect(await res.json()).toEqual(expected[kind][1]);
    expect(await snapshot()).toEqual(before);
  });
  it.each([{}, null, [], { discordId: 'bad', characterId: 'alt' }, ...[null, '', ' ', 42, {}].map((characterId) => ({ discordId, characterId }))])('rejects malformed body %j', async (body) => {
    const before = await snapshot();
    const res = await request(body);
    expect(res.status).toBe(400); expect(await res.json()).toMatchObject({ reason: 'invalid', error: expect.any(String) });
    expect(await snapshot()).toEqual(before);
  });
  it('rejects malformed JSON and oversized bodies, and authenticates before parsing or replay', async () => {
    const before = await snapshot();
    const malformed = await request(undefined, { raw: '{' });
    expect(malformed.status).toBe(400); expect(await malformed.json()).toEqual({ reason: 'invalid', error: 'Body must be JSON.' });
    expect((await request(undefined, { raw: ' '.repeat(65537) })).status).toBe(413);
    await request({ discordId, characterId: 'main' }, { key: 'known' });
    expect((await request(undefined, { raw: '{', key: 'known', secret: 'wrong' })).status).toBe(401);
    expect(await snapshot()).toEqual(before);
  });
});
