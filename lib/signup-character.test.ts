import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';
import { characterBrought } from './signup-character';
import { buildRoster } from '@/prisma/seed-data';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, discordId: '', role: 'member' }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ discordId: state.discordId, role: state.role, name: 'Sample' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false }));
import { PUT } from '@/app/api/raids/[id]/signup/route';
import { POST } from '@/app/api/raids/route';
import { applyDiscordAnswer } from '@/app/api/bot/raids/_respond';
import { loadRaidCards } from './raid-cards';
import { loadRaidView } from './raid-view';
import { generateInstances, runTick } from './tick';

it('prefers the chosen character, otherwise the main, otherwise none', () => {
  const main = { raidRole: 'TANK' }, alt = { raidRole: 'HEALER' };
  expect(characterBrought({ character: alt, user: { characters: [main] } })).toBe(alt);
  expect(characterBrought({ character: null, user: { characters: [main] } })).toBe(main);
  expect(characterBrought({ user: { characters: [] } })).toBeNull();
});
it('has no case-insensitive duplicates in the local roster seed', () => {
  const names = buildRoster().map((c) => c.name.toLowerCase());
  expect(new Set(names).size).toBe(names.length);
});

// SIGNUP_CHARACTER_INTEGRATION=1 npx vitest run lib/signup-character.test.ts
// Owns a fresh loopback-only PostgreSQL container, never an existing database.
describe.skipIf(process.env.SIGNUP_CHARACTER_INTEGRATION !== '1')('sign-up characters on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const future = new Date('2099-06-01T20:00:00Z');
  const character = (name: string) => ({ name, class: 'WARRIOR' as const, spec: 'Protection', raidRole: 'TANK' as const });
  const user = (id: string, main = true) => db.user.create({ data: { id, discordId: id, discordName: id, role: 'MEMBER', inGuild: false, characters: main ? { create: character(id) } : undefined }, include: { characters: true } });
  const raid = (id: string) => db.raid.create({ data: { id, name: id, startsAt: future, locksAt: future, requirements: {} } });
  const signup = (raidId: string, userId: string) => db.signup.findUniqueOrThrow({ where: { raidId_userId: { raidId, userId } } });
  const answer = async (raidId: string, body: object) => {
    const response = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: raidId }) });
    expect(response.status).toBe(200);
    return response.json();
  };

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=signup_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/signup_test` });
    for (let attempt = 0; ; attempt++) {
      try { await pool.query('SELECT 1'); break; } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    for (const folder of readdirSync('prisma/migrations').filter((f) => /^\d/.test(f)).sort()) {
      if (folder === '20261007120000_signup_character') {
        await pool.query(`INSERT INTO "User" (id, "discordId", "discordName") VALUES ('legacy', 'legacy', 'Sample'), ('empty', 'empty', 'Empty');
          INSERT INTO "Character" (id, "userId", name, class, spec, "raidRole") VALUES ('legacy-main', 'legacy', 'Redtape', 'WARRIOR', 'Protection', 'TANK');
          INSERT INTO "Raid" (id, name, "startsAt", "locksAt", requirements, "updatedAt") VALUES ('legacy', 'Legacy', '2099-06-01', '2099-06-01', '{}', NOW());
          INSERT INTO "Signup" (id, "raidId", "userId", response, source, "updatedAt") VALUES ('legacy', 'legacy', 'legacy', 'ACCEPT', 'WEB', NOW()), ('empty', 'legacy', 'empty', NULL, 'WEB', NOW());`);
      }
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

  it('backfills existing sign-ups and leaves members without a main null', async () => {
    expect((await signup('legacy', 'legacy')).characterId).toBe('legacy-main');
    expect((await signup('legacy', 'empty')).characterId).toBeNull();
  });
  it('rejects a second main and case-insensitive duplicate name', async () => {
    await expect(db.character.create({ data: { ...character('Other'), userId: 'legacy' } })).rejects.toMatchObject({ code: 'P2002' });
    await expect(db.character.create({ data: { ...character('redtape'), userId: 'empty' } })).rejects.toMatchObject({ code: 'P2002' });
  });
  it('site self/officer answers store the target main, preserve it after a main switch, and count the chosen role', async () => {
    const member = await user('web'), officer = await user('officer');
    await raid('web');
    state.discordId = member.id; state.role = 'member';
    await answer('web', { response: 'accept' });
    const original = member.characters[0].id;
    expect((await signup('web', member.id)).characterId).toBe(original);
    await db.character.update({ where: { id: original }, data: { isMain: false } });
    const newMain = await db.character.create({ data: { ...character('Newmain'), userId: member.id, raidRole: 'HEALER' } });
    await db.signup.update({ where: { raidId_userId: { raidId: 'web', userId: member.id } }, data: { standing: 'ROSTER' } });
    const result = await answer('web', { response: 'tentative' });
    expect(result.counts).toEqual({ tank: 0, healer: 0, melee: 0, ranged: 0 });
    await answer('web', { response: 'accept' });
    expect((await signup('web', member.id)).characterId).toBe(original);
    const cards = await loadRaidCards(new Date(0), member.discordId);
    expect(cards.find((c) => c.id === 'web')).toMatchObject({ signupRole: 'tank', counts: { tank: 1, healer: 0 } });
    expect((await loadRaidView('web', member.discordId))?.bars).toEqual({ tank: 1, healer: 0, melee: 0, ranged: 0 });
    // Directly choosing the new character changes all role readers, without a chooser UI.
    await db.signup.update({ where: { raidId_userId: { raidId: 'web', userId: member.id } }, data: { characterId: newMain.id } });
    expect((await answer('web', { response: 'accept' })).counts).toEqual({ tank: 0, healer: 1, melee: 0, ranged: 0 });
    await raid('officer');
    state.discordId = officer.id; state.role = 'officer';
    await answer('officer', { response: 'accept', forUserId: member.id });
    expect(await signup('officer', member.id)).toMatchObject({ characterId: newMain.id, setByUserId: officer.id });
    await db.character.delete({ where: { id: newMain.id } });
    expect((await signup('officer', member.id)).characterId).toBeNull();
    await db.character.update({ where: { id: original }, data: { isMain: true } });
    expect((await loadRaidCards(new Date(0), member.id)).find((c) => c.id === 'web')?.signupRole).toBe('tank');
  });
  it.each(['respond', 'bench'] as const)('bot %s stores the main and preserves it when answering again', async (kind) => {
    const member = await user(kind);
    await raid(kind);
    const action = kind === 'bench' ? { kind } : { kind, response: 'accept' as const, reason: null };
    expect((await applyDiscordAnswer(kind, member.discordId, action)).status).toBe(200);
    const original = member.characters[0].id;
    expect((await signup(kind, member.id)).characterId).toBe(original);
    await db.character.update({ where: { id: original }, data: { isMain: false } });
    await db.character.create({ data: { ...character(`${kind}replacement`), userId: member.id } });
    expect((await applyDiscordAnswer(kind, member.discordId, { kind: 'respond', response: 'tentative', reason: null })).status).toBe(200);
    expect((await signup(kind, member.id)).characterId).toBe(original);
  });
  it('site and bot creation without a main stores null and later answers keep null', async () => {
    const member = await user('no-main', false);
    await raid('no-main'); await raid('no-main-bot');
    state.discordId = member.id; state.role = 'member';
    await answer('no-main', { response: 'accept' });
    expect((await applyDiscordAnswer('no-main-bot', member.id, { kind: 'bench' })).status).toBe(200);
    expect((await signup('no-main', member.id)).characterId).toBeNull();
    expect((await signup('no-main-bot', member.id)).characterId).toBeNull();
    await db.character.create({ data: { ...character('LateMain'), userId: member.id } });
    await answer('no-main', { response: 'tentative' });
    await applyDiscordAnswer('no-main-bot', member.id, { kind: 'respond', response: 'tentative', reason: null });
    expect((await signup('no-main', member.id)).characterId).toBeNull();
    expect((await signup('no-main-bot', member.id)).characterId).toBeNull();
  });
  it('officer scheduling, recurring instances and tick roster additions capture mains or null', async () => {
    const member = await user('roster'), empty = await user('roster-empty', false);
    await db.user.updateMany({ where: { id: { in: [member.id, empty.id] } }, data: { inGuild: true, rank: 'RAIDER' } });
    state.discordId = 'officer'; state.role = 'officer';
    const result = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Scheduled', date: '2099-06-01', time: '20:00', durationMin: 180, requirements: { tank: 1, healer: 1, melee: 0, ranged: 0 } }) }));
    expect(result.status).toBe(201);
    const scheduled = (await result.json()).id;
    const template = await db.raidTemplate.create({ data: { name: 'Sample', short: 'S', size: 10, requirements: {} } });
    const series = await db.raidSeries.create({ data: { templateId: template.id, weekday: 2, startTime: '20:00', durationMin: 180, horizonWeeks: 1, createdById: 'officer' } });
    expect(await generateInstances(new Date('2099-05-01'), [member.id, empty.id], series.id)).toBeGreaterThan(0);
    const generated = await db.raid.findFirstOrThrow({ where: { seriesId: series.id } });
    await db.raidSeries.update({ where: { id: series.id }, data: { active: false } });
    await raid('tick-added');
    await runTick(new Date('2099-05-01'));
    for (const id of [scheduled, generated.id, 'tick-added']) {
      expect(await signup(id, member.id)).toMatchObject({ characterId: member.characters[0].id, response: null });
      expect((await signup(id, empty.id)).characterId).toBeNull();
    }
    await db.character.update({ where: { id: member.characters[0].id }, data: { isMain: false } });
    await db.character.create({ data: { ...character('RosterReplacement'), userId: member.id } });
    await runTick(new Date('2099-05-01'));
    expect((await signup('tick-added', member.id)).characterId).toBe(member.characters[0].id);
  });
});
