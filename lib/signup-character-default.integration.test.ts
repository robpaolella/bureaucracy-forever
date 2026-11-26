import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient, session: { discordId: 'member', role: 'member' } }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ ...state.session, name: 'Sample' }) }));
vi.mock('@/lib/flags', () => ({ lootEnabled: () => false, openUntilStart: () => false }));
import { PUT } from '@/app/api/raids/[id]/signup/route';
import { PUT as SET_DEFAULT } from '@/app/api/me/characters/default/route';
import { applyDiscordAnswer } from '@/app/api/bot/raids/_respond';
import { REASONS } from './signup-rules';

type Answer = 'accept' | 'tentative' | 'absent';
const SURFACES = ['web', 'discord'] as const;

// SIGNUP_DEFAULT_INTEGRATION=1 npx vitest run lib/signup-character-default.integration.test.ts
// Like signup-character.test.ts, owns a new loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.SIGNUP_DEFAULT_INTEGRATION !== '1')('default sign-up character on PostgreSQL (#560)', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const future = new Date('2099-06-01T20:00:00Z');
  const row = () => db.signup.findUnique({ where: { raidId_userId: { raidId: 'raid', userId: 'member' } } });
  const brought = async () => (await row())?.characterId;
  const defaultOf = async (id = 'member') => (await db.user.findUniqueOrThrow({ where: { id } })).defaultCharacterId;
  const setDefault = (characterId: string | null) => db.user.update({ where: { id: 'member' }, data: { defaultCharacterId: characterId } });

  const web = async (body: Record<string, unknown>, as = 'member') => {
    state.session = { discordId: as, role: as === 'officer' ? 'officer' : 'member' };
    const response = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'raid' }) });
    return { status: response.status, body: await response.json() };
  };
  const discord = async (response: Answer, characterId?: string) => {
    const result = await applyDiscordAnswer('raid', 'member', { kind: 'respond', response, reason: null, ...(characterId ? { characterId } : {}) });
    return { status: result.status, body: result.body as Record<string, unknown> };
  };
  const answer = (surface: typeof SURFACES[number], response: Answer, characterId?: string) =>
    surface === 'web' ? web({ response, ...(characterId ? { characterId } : {}) }) : discord(response, characterId);

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=default_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/default_test`, max: 10 });
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
    await pool.query('TRUNCATE "User", "Raid", "RaidTemplate", "OutboxJob" CASCADE');
    for (const [id, role] of [['member', 'MEMBER'], ['stranger', 'MEMBER'], ['officer', 'OFFICER']] as const) {
      await db.user.create({ data: { id, discordId: id, discordName: id, role, inGuild: true } });
    }
    for (const [id, userId, isMain, raidRole] of [['main', 'member', true, 'TANK'], ['alt', 'member', false, 'HEALER'], ['alt2', 'member', false, 'HEALER'], ['foreign', 'stranger', true, 'TANK']] as const) {
      await db.character.create({ data: { id, userId, name: id, isMain, raidRole, class: 'WARRIOR', spec: 'Sample' } });
    }
    await db.raidTemplate.create({ data: { id: 'tier', name: 'Sample tier', short: 'S', size: 10, requirements: {} } });
    await db.raid.create({ data: { id: 'raid', name: 'raid', startsAt: future, locksAt: future, templateId: 'tier', requirements: {}, discordThreadId: 'thread' } });
    // Like the roster's rows made in advance: unanswered, holding the main.
    await db.signup.create({ data: { raidId: 'raid', userId: 'member', characterId: 'main', source: 'WEB' } });
  });

  describe.each(SURFACES)('the %s answer follows the table', (surface) => {
    it('first Accept/Tentative with a character chosen brings the chosen one', async () => {
      await setDefault('alt2');
      expect((await answer(surface, 'tentative', 'alt')).status).toBe(200);
      expect(await row()).toMatchObject({ response: 'TENTATIVE', characterId: 'alt' });
    });
    it('first Accept/Tentative with none chosen brings the default', async () => {
      await setDefault('alt');
      const result = await answer(surface, 'accept');
      expect(result.status).toBe(200);
      if (surface === 'web') expect(result.body.characterId).toBe('alt');
      expect(await row()).toMatchObject({ response: 'ACCEPT', characterId: 'alt' });
    });
    it('first Accept/Tentative with none chosen and no default keeps the row\'s character', async () => {
      await db.signup.update({ where: { raidId_userId: { raidId: 'raid', userId: 'member' } }, data: { characterId: 'alt2' } });
      expect((await answer(surface, 'accept')).status).toBe(200);
      expect(await brought()).toBe('alt2');
    });
    it('a first Accept without a row (the bench) brings the default, or the main without one', async () => {
      await db.signup.deleteMany();
      await setDefault('alt');
      expect((await answer(surface, 'accept')).status).toBe(200);
      expect(await row()).toMatchObject({ standing: 'BENCH', characterId: 'alt' });
      await db.signup.deleteMany(); await setDefault(null);
      expect((await answer(surface, 'tentative')).status).toBe(200);
      expect(await brought()).toBe('main');
    });
    it('Absent then Accept counts as a first answer', async () => {
      expect((await answer(surface, 'absent')).status).toBe(200);
      await setDefault('alt');
      expect((await answer(surface, 'accept')).status).toBe(200);
      expect(await brought()).toBe('alt');
    });
    it('Accept ↔ Tentative and Accept/Tentative → Absent keep the character, and so does a later default', async () => {
      expect((await answer(surface, 'accept')).status).toBe(200);
      await setDefault('alt');
      for (const next of ['tentative', 'accept', 'absent'] as const) {
        expect((await answer(surface, next)).status).toBe(200);
        expect(await brought()).toBe('main');
      }
    });
    it('withdrawn, then answered again, counts as a first answer', async () => {
      expect((await answer(surface, 'accept')).status).toBe(200);
      await setDefault('alt');
      expect((await web({ response: null })).status).toBe(200);
      expect((await answer(surface, 'tentative')).status).toBe(200);
      expect(await brought()).toBe('alt');
    });
    it('a deleted default clears it, and the next first Accept brings the row\'s main', async () => {
      await setDefault('alt');
      await db.character.delete({ where: { id: 'alt' } });
      expect(await defaultOf()).toBeNull();
      expect((await answer(surface, 'accept')).status).toBe(200);
      expect(await brought()).toBe('main');
    });
    it('someone else\'s character is refused with 400 and nothing is written', async () => {
      const result = await answer(surface, 'accept', 'foreign');
      expect(result.status).toBe(400);
      expect(await row()).toMatchObject({ response: null, characterId: 'main' });
    });
    it('a switch refusal (the raid cancelled between the check and the write) rolls everything back', async () => {
      // The route has read the raid as open; the answer's own write cancels it, so the
      // switch that follows inside the same transaction finds it closed.
      await pool.query(`CREATE FUNCTION cancel_raid() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "Raid" SET "cancelledAt" = NOW(); RETURN NULL; END $$;
        CREATE TRIGGER cancel_raid AFTER UPDATE ON "Signup" FOR EACH ROW EXECUTE FUNCTION cancel_raid();`);
      onTestFinished(() => pool.query('DROP TRIGGER cancel_raid ON "Signup"; DROP FUNCTION cancel_raid();').then(() => undefined));
      const result = surface === 'web' ? await web({ response: 'accept', characterId: 'alt', makeDefault: true }) : await discord('accept', 'alt');
      expect(result.status).toBe(409);
      expect(await row()).toMatchObject({ response: null, characterId: 'main' });
      expect(await defaultOf()).toBeNull();
      expect((await db.raid.findUniqueOrThrow({ where: { id: 'raid' } })).cancelledAt).toBeNull();
      expect(await db.outboxJob.count()).toBe(0);
    });
  });

  describe('the website route', () => {
    it.each([
      ['makeDefault with forUserId', { response: 'accept', characterId: 'alt', makeDefault: true, forUserId: 'member' }, 'officer', undefined],
      ['another member\'s character', { response: 'accept', characterId: 'foreign' }, 'member', 'That character is no longer available. Choose another and try again.'],
      ['a character with Absent', { response: 'absent', characterId: 'alt' }, 'member', undefined],
      ['a character with a withdrawal', { response: null, characterId: 'alt' }, 'member', undefined],
      ['makeDefault without a character', { response: 'accept', makeDefault: true }, 'member', undefined],
      ['an officer\'s character for someone else', { response: 'accept', characterId: 'foreign', forUserId: 'member' }, 'officer', 'That character is no longer available for this member. Choose another and try again.'],
    ])('refuses %s with 400 and writes nothing', async (_name, body, as, expectedError) => {
      const result = await web(body, as);
      expect(result.status).toBe(400);
      if (expectedError) expect(result.body.error).toBe(expectedError);
      else expect(result.body.error).toEqual(expect.any(String));
      expect(await row()).toMatchObject({ response: null, characterId: 'main' });
      expect(await defaultOf()).toBeNull();
    });
    it('makeDefault saves the chosen character as the default in the same write', async () => {
      const result = await web({ response: 'accept', characterId: 'alt', makeDefault: true });
      expect(result).toMatchObject({ status: 200, body: { response: 'accept', characterId: 'alt' } });
      expect(await defaultOf()).toBe('alt');
      expect(await brought()).toBe('alt');
    });
    it('an officer answering on a locked raid brings the member\'s default and never changes it', async () => {
      await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(Date.now() - 60_000) } });
      await setDefault('alt');
      expect((await web({ response: 'accept' })).status).toBe(409);
      const result = await web({ response: 'tentative', forUserId: 'member' }, 'officer');
      expect(result).toMatchObject({ status: 200, body: { characterId: 'alt' } });
      expect(await row()).toMatchObject({ response: 'TENTATIVE', characterId: 'alt', setByUserId: 'officer' });
      expect(await defaultOf()).toBe('alt');
    });
    it('the members\' characters API sets the default only to their own character, and clears it', async () => {
      state.session = { discordId: 'member', role: 'member' };
      expect((await SET_DEFAULT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ characterId: 'foreign' }) }))).status).toBe(404);
      expect((await SET_DEFAULT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ characterId: 'missing' }) }))).status).toBe(404);
      expect((await SET_DEFAULT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ characterId: 'alt' }) }))).status).toBe(200);
      expect(await defaultOf()).toBe('alt');
      expect((await SET_DEFAULT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ characterId: null }) }))).status).toBe(200);
      expect(await defaultOf()).toBeNull();
    });
  });

  it('a web answer and a Discord answer at once end with one writer\'s answer and character', async () => {
    // Serially: web then Discord gives (Tentative, alt); Discord then web gives (Accept, alt).
    // Discord's Tentative is a first answer only when it runs first, so the default (alt2)
    // may never survive: both answers decide under the same sign-up lock.
    await setDefault('alt2');
    for (let round = 0; round < 10; round++) {
      await db.signup.update({ where: { raidId_userId: { raidId: 'raid', userId: 'member' } }, data: { response: null, characterId: 'main' } });
      const [w, d] = await Promise.all([web({ response: 'accept', characterId: 'alt' }), discord('tentative')]);
      expect([w.status, d.status]).toEqual([200, 200]);
      const final = await row();
      expect(final?.characterId).toBe('alt');
      expect(['ACCEPT', 'TENTATIVE']).toContain(final?.response);
    }
  });

  it('every answer waits for the member\'s sign-up lock, so a web and a Discord answer never interleave', async () => {
    const holder = await pool.connect();
    try {
      await holder.query('BEGIN');
      await holder.query(`SELECT pg_advisory_xact_lock(hashtext('signup-answer'), hashtext('raid:member'))`);
      const pending = Promise.all([discord('accept'), web({ response: 'tentative', characterId: 'alt' })]);
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(await row()).toMatchObject({ response: null, characterId: 'main' });
      await holder.query('COMMIT');
      expect((await pending).map((r) => r.status)).toEqual([200, 200]);
    } finally { holder.release(); }
  });

  it('a closed raid refuses before any character rule runs', async () => {
    await db.raid.update({ where: { id: 'raid' }, data: { locksAt: new Date(Date.now() - 60_000) } });
    expect(await discord('accept', 'alt')).toMatchObject({ status: 409, body: { reason: REASONS.locked } });
  });
});
