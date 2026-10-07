import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, loot: true, session: { discordId: 'member', role: 'member' } as { discordId: string; role: string } | null }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => state.session && { ...state.session, name: 'Sample' } }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => state.loot }));
import { switchCharacter, switchCharacterInTransaction } from './character-switch';
import { PUT } from '@/app/api/raids/[id]/signup/character/route';
import { REASONS } from './signup-rules';
import { loadReserveTargets } from './loot-data';
import { PUT as saveReserves } from '@/app/api/raids/[id]/reserves/route';

// CHARACTER_SWITCH_INTEGRATION=1 npx vitest run lib/character-switch.integration.test.ts
// Like signup-character.test.ts, owns a new loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.CHARACTER_SWITCH_INTEGRATION !== '1')('character switches on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const future = new Date('2099-06-01T20:00:00Z');
  const input = { raidId: 'raid', userId: 'member', characterId: 'alt', actor: { role: 'member' as const } };
  const signup = () => db.signup.findUniqueOrThrow({ where: { id: 'signup' } });
  const reserves = () => db.reserve.findMany({ where: { raidId: 'raid', userId: 'member' }, orderBy: { kind: 'asc' } });
  const request = (body: unknown = { characterId: 'alt' }, id = 'raid') => PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  const award = (data: Partial<Prisma.LootAwardUncheckedCreateInput> = {}) => db.lootAward.create({ data: { raidId: 'other', itemId: 1, characterId: 'alt', characterName: 'alt', method: 'HR', recordedById: 'officer', ...data } });
  const policy = (itemId: number, data: { blocked?: boolean; winLimit?: number }) => db.lootReserveSetting.create({ data: { templateId: 'tier', itemId, ...data } });

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=switch_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/switch_test` });
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
  afterAll(async () => { await db?.$disconnect(); await pool?.end(); if (container) docker('stop', container); });
  beforeEach(async () => {
    await pool.query('TRUNCATE "User", "Raid", "RaidTemplate", "LootItem", "OutboxJob" CASCADE');
    state.session = { discordId: 'member', role: 'member' }; state.loot = true;
    for (const id of ['member', 'stranger']) await db.user.create({ data: { id, discordId: id, discordName: id, role: 'MEMBER' } });
    for (const [id, userId, isMain, raidRole] of [['main', 'member', true, 'TANK'], ['alt', 'member', false, 'HEALER'], ['foreign', 'stranger', true, 'TANK']] as const) {
      await db.character.create({ data: { id, userId, name: id, isMain, raidRole, class: 'WARRIOR', spec: 'Sample' } });
    }
    await db.raidTemplate.create({ data: { id: 'tier', name: 'Sample tier', short: 'S', size: 10, requirements: {} } });
    for (const id of ['raid', 'other']) await db.raid.create({ data: { id, name: id, startsAt: future, locksAt: future, templateId: 'tier', requirements: {}, discordThreadId: `${id}-thread` } });
    await db.signup.create({ data: { id: 'signup', raidId: 'raid', userId: 'member', characterId: 'main', response: 'ACCEPT', source: 'WEB' } });
    await db.lootBoss.create({ data: { id: 'boss', templateId: 'tier', name: 'Sample boss', position: 0 } });
    for (const id of [1, 2]) {
      await db.lootItem.create({ data: { id, name: `Item ${id}`, source: 'CLASSIC', quality: 4, icon: 'sample', tooltipHtml: '', fetchedAt: new Date() } });
      await db.lootTableEntry.create({ data: { bossId: 'boss', itemId: id, position: id } });
      await db.reserve.create({ data: { raidId: 'raid', userId: 'member', characterId: 'main', itemId: id, kind: id === 1 ? 'HR' : 'SR', setById: 'officer' } });
    }
  });

  const save = (body: object = { characterId: 'alt', hr: 1, sr: 2 }) => saveReserves(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'raid' }) });

  it('a reserve save switches the signup and reports removed reserves', async () => {
    await award();
    const response = await save({ characterId: 'alt', hr: null, sr: 2 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ characterId: 'alt', hr: null, sr: 2, removed: [{ kind: 'HR', itemId: 1, itemName: 'Item 1', reason: 'This character already won that item.' }] });
    expect((await signup()).characterId).toBe('alt');
    expect(await reserves()).toMatchObject([{ characterId: 'alt', kind: 'SR', itemId: 2 }]);
  });
  it.each(['won', 'reserve-lock', 'foreign', 'absent', 'cancelled', 'done'])('refused reserve save (%s) rolls back signup, reserves and outbox', async (reason) => {
    if (reason === 'won') await award();
    if (reason === 'reserve-lock') await db.raid.update({ where: { id: 'raid' }, data: { startsAt: new Date(Date.now() + 3600_000) } });
    if (reason === 'absent') await db.signup.update({ where: { id: 'signup' }, data: { response: 'ABSENT' } });
    if (reason === 'cancelled') await db.raid.update({ where: { id: 'raid' }, data: { cancelledAt: new Date() } });
    if (reason === 'done') await db.raid.update({ where: { id: 'raid' }, data: { startsAt: new Date(0) } });
    const before = { signup: await signup(), reserves: await reserves() };
    expect((await save({ characterId: reason === 'foreign' ? 'foreign' : 'alt', hr: 1, sr: 2 })).status).toBe(reason === 'foreign' ? 403 : 409);
    expect({ signup: await signup(), reserves: await reserves() }).toEqual(before);
    expect(await db.outboxJob.count()).toBe(0);
  });
  it('first reserves default to the signed-up alt and keep that character on save', async () => {
    await db.reserve.deleteMany();
    await db.signup.update({ where: { id: 'signup' }, data: { characterId: 'alt' } });
    await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(0) } });
    const before = await signup();
    const { targets } = await loadReserveTargets('raid', 'member', false);
    expect(targets[0].current).toEqual({ characterId: 'alt', hr: null, sr: null });
    expect((await save({ characterId: targets[0].current.characterId, hr: 1, sr: 2 })).status).toBe(200);
    expect(await signup()).toEqual(before);
    expect((await reserves()).map((r) => r.characterId)).toEqual(['alt', 'alt']);
    expect(await db.outboxJob.count()).toBe(0);
  });
  it.each(['accept', 'absent', 'signup-locked'])('clears legacy mismatched reserves without switching (%s)', async (state) => {
    await db.reserve.updateMany({ data: { characterId: 'alt' } });
    if (state === 'absent') await db.signup.update({ where: { id: 'signup' }, data: { response: 'ABSENT' } });
    if (state === 'signup-locked') await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(0) } });
    const before = await signup();
    const response = await save({ characterId: 'alt', hr: null, sr: null });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ characterId: 'alt', hr: null, sr: null, removed: [] });
    expect(await signup()).toEqual(before);
    expect(await reserves()).toEqual([]);
    expect(await db.outboxJob.count()).toBe(0);
  });
  it.each(['member', 'officer-self', 'officer-explicit-self', 'officer-other'])('reserve switch respects signup lock for %s', async (actor) => {
    await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(0) } });
    if (actor !== 'member') state.session = { discordId: 'stranger', role: 'officer' };
    if (actor === 'officer-self' || actor === 'officer-explicit-self') state.session!.discordId = 'member';
    const before = { signup: await signup(), reserves: await reserves() };
    const response = await save({ characterId: 'alt', hr: 1, sr: 2, ...(['officer-other', 'officer-explicit-self'].includes(actor) ? { forUserId: 'member' } : {}) });
    expect(response.status).toBe(actor === 'officer-other' ? 200 : 409);
    if (actor === 'officer-other') expect((await signup()).characterId).toBe('alt');
    else {
      expect(await response.json()).toEqual({ error: REASONS.locked });
      expect({ signup: await signup(), reserves: await reserves() }).toEqual(before);
    }
  });
  it.each(['main', null])('same-character reserve save (%s) bypasses signup lock without switching', async (characterId) => {
    await db.signup.update({ where: { id: 'signup' }, data: { characterId } });
    await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(0) } });
    const before = await signup();
    const response = await save({ characterId: 'main', hr: 1, sr: 2 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ characterId: 'main', hr: 1, sr: 2, removed: [] });
    expect(await signup()).toEqual(before);
    expect(await db.outboxJob.count()).toBe(0);
  });

  it('moves both reserves without replacing their identity/setter and refreshes only this raid', async () => {
    const before = await reserves();
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toMatchObject({ character: { id: 'alt', name: 'alt', raidRole: 'HEALER' }, removed: [] });
    expect((await signup()).characterId).toBe('alt');
    expect(await reserves()).toEqual(before.map((r) => ({ ...r, characterId: 'alt', updatedAt: expect.any(Date) })));
    expect(await db.outboxJob.findMany()).toMatchObject([{ type: 'raid.update', payload: { raidId: 'raid' } }]);
  });
  it('reports won HR and blocked SR removals, including item names and reasons', async () => {
    await award(); await policy(2, { blocked: true });
    expect(await switchCharacter(input)).toMatchObject({ ok: true, removed: [
      { kind: 'HR', itemId: 1, itemName: 'Item 1', reason: 'This character already won that item.' },
      { kind: 'SR', itemId: 2, itemName: 'Item 2', reason: 'Not open to reserves' },
    ] });
    expect(await reserves()).toEqual([]);
  });
  it('respects win limits and ignores voided/non-reserve awards', async () => {
    await policy(1, { winLimit: 2 }); await award({ method: 'SR' });
    await award({ voidedAt: new Date() }); await award({ method: 'OPEN_ROLL' });
    expect(await switchCharacter(input)).toMatchObject({ ok: true, removed: [] });
    await switchCharacter({ ...input, characterId: 'main' });
    await award();
    expect(await switchCharacter(input)).toMatchObject({ ok: true, removed: [{ kind: 'HR', itemId: 1 }] });
  });
  it.each(['main', null])('same brought character (%s) writes nothing, even with now-invalid reserves', async (characterId) => {
    await db.signup.update({ where: { id: 'signup' }, data: { characterId } });
    await policy(1, { blocked: true }); await award({ characterId: 'main' });
    const before = { signup: await signup(), reserves: await reserves() };
    expect(await switchCharacter({ ...input, characterId: 'main' })).toMatchObject({ ok: true, removed: [] });
    expect({ signup: await signup(), reserves: await reserves() }).toEqual(before);
    expect(await db.outboxJob.count()).toBe(0);
  });
  it.each(['same-role', 'unposted', 'bench', 'tentative'])('does not refresh for %s', async (kind) => {
    if (kind === 'same-role') await db.character.update({ where: { id: 'alt' }, data: { raidRole: 'TANK' } });
    if (kind === 'unposted') await db.raid.update({ where: { id: 'raid' }, data: { discordThreadId: null } });
    if (kind === 'bench') await db.signup.update({ where: { id: 'signup' }, data: { standing: 'BENCH' } });
    if (kind === 'tentative') await db.signup.update({ where: { id: 'signup' }, data: { response: 'TENTATIVE' } });
    expect(await switchCharacter(input)).toMatchObject({ ok: true });
    expect(await db.outboxJob.count()).toBe(0);
  });
  it.each(['loot-off', 'no-tier', 'empty-table', 'no-reserves'])('switches without removal with %s', async (kind) => {
    await award(); await policy(2, { blocked: true });
    if (kind === 'loot-off') state.loot = false;
    if (kind === 'no-tier') await db.raid.update({ where: { id: 'raid' }, data: { templateId: null } });
    if (kind === 'empty-table') await db.lootTableEntry.deleteMany();
    if (kind === 'no-reserves') await db.reserve.deleteMany();
    expect(await switchCharacter(input)).toMatchObject({ ok: true, removed: [] });
    expect((await signup()).characterId).toBe('alt');
    expect((await reserves()).every((r) => r.characterId === 'alt')).toBe(true);
  });
  it.each(['time', 'status'])('member obeys the sign-up %s lock, officer can switch for them', async (kind) => {
    await db.raid.update({ where: { id: 'raid' }, data: kind === 'time' ? { locksAt: new Date(0) } : { status: 'LOCKED' } });
    const response = await request();
    expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: REASONS.locked });
    expect((await signup()).characterId).toBe('main');
    state.session = { discordId: 'member', role: 'officer' };
    for (const body of [{ characterId: 'alt' }, { characterId: 'alt', forUserId: 'member' }]) {
      const own = await request(body);
      expect(own.status).toBe(409); expect(await own.json()).toEqual({ error: REASONS.locked });
    }
    state.session = { discordId: 'stranger', role: 'officer' };
    expect((await request({ characterId: 'alt', forUserId: 'member' })).status).toBe(200);
  });
  it.each(['CANCELLED', 'DONE', 'cancelled-at', 'past'] as const)('refuses %s even for officers', async (kind) => {
    const data = kind === 'cancelled-at' ? { cancelledAt: new Date() } : kind === 'past' ? { startsAt: new Date(0) } : { status: kind };
    await db.raid.update({ where: { id: 'raid' }, data });
    expect(await switchCharacter({ ...input, actor: { role: 'officer' }, officerOverride: true })).toMatchObject({ ok: false, status: 409 });
  });
  it.each(['ABSENT', null, 'missing'] as const)('refuses ineligible answer %s', async (response) => {
    if (response === 'missing') await db.signup.deleteMany();
    else await db.signup.update({ where: { id: 'signup' }, data: { response } });
    expect((await request()).status).toBe(409);
    expect((await reserves()).every((r) => r.characterId === 'main')).toBe(true);
    expect(await db.outboxJob.count()).toBe(0);
  });
  it('rejects foreign characters, impersonation, missing records, malformed input and unauthenticated/social callers', async () => {
    expect((await request({ characterId: 'foreign' })).status).toBe(403);
    expect((await request({ characterId: 'foreign', forUserId: 'stranger' })).status).toBe(403);
    expect((await request({}, 'raid')).status).toBe(400);
    expect((await request({ characterId: 'alt', forUserId: 42 })).status).toBe(400);
    expect((await request({ characterId: 'alt' }, 'missing')).status).toBe(404);
    state.session = { discordId: 'stranger', role: 'officer' };
    expect((await request({ characterId: 'alt', forUserId: 'missing' })).status).toBe(404);
    state.session = { discordId: 'member', role: 'social' }; expect((await request()).status).toBe(403);
    state.session = null; expect((await request()).status).toBe(401);
    expect((await signup()).characterId).toBe('main');
  });
  it('rolls back the switch, removals and outbox when a composing caller fails', async () => {
    await award();
    const before = { signup: await signup(), reserves: await reserves() };
    await expect(db.$transaction(async (tx) => {
      expect(await switchCharacterInTransaction(tx, input)).toMatchObject({ ok: true });
      throw new Error('save failed');
    }, { isolationLevel: 'ReadCommitted' })).rejects.toThrow('save failed');
    expect({ signup: await signup(), reserves: await reserves() }).toEqual(before);
    expect(await db.outboxJob.count()).toBe(0);
  });
  it('serializes simultaneous identical switches into one change and one refresh', async () => {
    expect((await Promise.all([switchCharacter(input), switchCharacter(input)])).every((r) => r.ok)).toBe(true);
    expect((await signup()).characterId).toBe('alt');
    expect(await db.outboxJob.count()).toBe(1);
  });
});
