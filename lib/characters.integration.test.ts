import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
import { addAlt, editCharacter, removeCharacter } from './characters';

const input = (name: string, healer = false) => ({ name, wowClass: 'paladin', spec: healer ? 'Holy' : 'Protection', role: healer ? 'healer' : 'tank' });

// CHARACTERS_INTEGRATION=1 npx vitest run lib/characters.integration.test.ts
// Like signup-character.test.ts, owns a disposable loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.CHARACTERS_INTEGRATION !== '1')('character rules on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const member = (id: string, main = true) => db.user.create({ data: {
    id, discordId: id, discordName: id, rank: 'RAIDER',
    characters: main ? { create: { name: id, class: 'PALADIN', spec: 'Protection', raidRole: 'TANK' } } : undefined,
  }, include: { characters: true } });
  const raid = (id: string, userId: string, characterId: string | null, posted = true, status: 'SCHEDULED' | 'LOCKED' | 'DONE' = 'SCHEDULED') => db.raid.create({ data: {
    id, name: id, startsAt: new Date('2099-06-01'), locksAt: new Date('2099-06-01'), requirements: {},
    discordThreadId: posted ? id : null, status,
    signups: { create: { userId, characterId, response: 'ACCEPT', source: 'WEB' } },
  } });
  const jobs = async () => (await db.outboxJob.findMany({ where: { type: 'raid.update' } })).map((j) => (j.payload as { raidId: string }).raidId).sort();

  // Both real transactions finish reading before either can insert; retries do not wait.
  async function race(adds: (() => ReturnType<typeof addAlt>)[]) {
    let arrived = 0, release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const timer = setTimeout(release, 5000);
    state.db = db.$extends({ query: { user: { async findUnique({ args, query }) {
      const user = await query(args);
      if (++arrived <= 2) {
        if (arrived === 2) release();
        await ready;
        if (arrived < 2) throw new Error('Concurrent transactions did not overlap');
      }
      return user;
    } } } }) as unknown as PrismaClient;
    try { return await Promise.all(adds.map((add) => add())); }
    finally { clearTimeout(timer); state.db = db; }
  }

  beforeAll(async () => {
    container = docker('run', '-d', '--rm', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD=worker', '-e', 'POSTGRES_USER=worker', '-e', 'POSTGRES_DB=characters_test', 'postgres:17');
    const binding = docker('port', container, '5432/tcp');
    if (!/^127\.0\.0\.1:\d+$/.test(binding)) throw new Error('Expected loopback-only database');
    pool = new Pool({ connectionString: `postgresql://worker:worker@${binding}/characters_test` });
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
  }, 120_000);
  afterAll(async () => {
    await db?.$disconnect();
    await pool?.end();
    if (container) docker('stop', container);
  });

  it('adds an alt with current rank; retries return it without changing its fields', async () => {
    await member('Adder');
    const added = await addAlt('Adder', { ...input('Second'), rank: 'officer' });
    expect(added).toMatchObject({ status: 201, character: { isMain: false, rank: 'RAIDER', name: 'Second' } });
    expect(await addAlt('Adder', input('sEcOnD', true))).toMatchObject({ status: 200, character: { spec: 'Protection' } });
    expect(await db.character.count({ where: { userId: 'Adder' } })).toBe(2);
    expect(await addAlt('Adder', input('aDdEr'))).toEqual({ status: 409, reason: 'name_taken', error: 'You already have a character with that name.' });
    await member('Other');
    expect(await addAlt('Other', input('SECOND'))).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
  });
  it('rejects missing members, missing mains and invalid fields', async () => {
    expect(await addAlt('missing', input('Valid'))).toEqual({ status: 404, reason: 'not_found', error: 'No such member.' });
    await member('Empty', false);
    expect(await addAlt('Empty', input('Valid'))).toEqual({ status: 409, reason: 'no_main', error: 'Set a main first.' });
    for (const bad of [{ name: '1' }, { wowClass: 'bad' }, { spec: 'bad' }, { role: 'ranged' }]) {
      expect(await addAlt('Empty', { ...input('Valid'), ...bad })).toMatchObject({ status: 400, reason: 'invalid' });
    }
  });
  it('two simultaneous adds at seven leave eight; a ninth is refused, a retry still works', async () => {
    await member('Capped');
    for (const name of ['Onealt', 'Twoalt', 'Threealt', 'Fouralt', 'Fivealt', 'Sixalt']) await addAlt('Capped', input(name));
    const results = await race(['Raceone', 'Racetwo'].map((name) => () => addAlt('Capped', input(name))));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)).toEqual({ status: 409, reason: 'limit', error: 'You can have up to 8 characters.' });
    expect(await db.character.count({ where: { userId: 'Capped' } })).toBe(8);
    expect(await addAlt('Capped', input('Ninth'))).toEqual({ status: 409, reason: 'limit', error: 'You can have up to 8 characters.' });
    expect(await addAlt('Capped', input('Onealt'))).toMatchObject({ status: 200 });
  });
  it('resolves concurrent same-name adds as a retry or other-member collision', async () => {
    await member('Racer'); await member('Rival');
    const same = await race([() => addAlt('Racer', input('Shared')), () => addAlt('Racer', input('SHARED'))]);
    expect(same.map((r) => r.status).sort()).toEqual([200, 201]);
    const different = await race([() => addAlt('Racer', input('Contested')), () => addAlt('Rival', input('CONTESTED'))]);
    expect(different.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(different.find((r) => r.status === 409)).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
  });
  it('edits safely and refreshes only chosen posted active raids, with null choices for mains', async () => {
    const user = await member('Editor');
    const added = await addAlt(user.id, input('Editable'));
    if (!('character' in added)) throw new Error('Expected alt');
    const alt = added.character, main = user.characters[0];
    await raid('alt-choice', user.id, alt.id); await raid('locked-choice', user.id, alt.id, true, 'LOCKED');
    await raid('main-choice', user.id, main.id); await raid('null-choice', user.id, null);
    await raid('unposted', user.id, alt.id, false); await raid('completed', user.id, alt.id, true, 'DONE');
    expect(await editCharacter(user.id, alt.id, input('EDITOR'))).toEqual({ status: 409, reason: 'name_taken', error: 'You already have a character with that name.' });
    expect(await editCharacter(user.id, alt.id, input('OTHER'))).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
    expect(await editCharacter('Other', alt.id, input('Stolen'))).toMatchObject({ status: 404, reason: 'not_found' });
    expect(await editCharacter(user.id, alt.id, { ...input('Editable', true), rank: 'officer' })).toMatchObject({ status: 200, character: { rank: 'RAIDER' } });
    expect(await jobs()).toEqual(['alt-choice', 'locked-choice']);
    await db.outboxJob.deleteMany();
    await editCharacter(user.id, alt.id, input('Renamed', true));
    expect(await jobs()).toEqual([]);
    await editCharacter(user.id, main.id, input('Editor', true));
    expect(await jobs()).toEqual(['main-choice', 'null-choice']);
    await db.outboxJob.deleteMany();
  });
  it('removes an alt with loot, cascades reserves, falls back signups and queues refresh atomically', async () => {
    const user = await member('Remover');
    const added = await addAlt(user.id, input('Looted'));
    if (!('character' in added)) throw new Error('Expected alt');
    const alt = added.character;
    await raid('deletion', user.id, alt.id);
    await db.lootItem.create({ data: { id: 1, name: 'Sample', quality: 4, icon: 'sample', tooltipHtml: '', source: 'FOREVER', fetchedAt: new Date() } });
    await db.reserve.create({ data: { raidId: 'deletion', userId: user.id, characterId: alt.id, itemId: 1, kind: 'SR' } });
    const award = await db.lootAward.create({ data: { raidId: 'deletion', userId: user.id, characterId: alt.id, characterName: alt.name, itemId: 1, method: 'SR', recordedById: user.id } });
    expect(await removeCharacter(user.id, user.characters[0].id)).toEqual({ status: 409, reason: 'main', error: 'Make another character the main first.' });
    expect(await removeCharacter('Other', alt.id)).toMatchObject({ status: 404, reason: 'not_found' });
    // A failed outbox insert must roll back the whole removal.
    await pool.query(`CREATE FUNCTION reject_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox unavailable'; END $$;
      CREATE TRIGGER reject_job BEFORE INSERT ON "OutboxJob" FOR EACH ROW EXECUTE FUNCTION reject_job();`);
    try {
      await expect(removeCharacter(user.id, alt.id)).rejects.toThrow('outbox unavailable');
      await expect(editCharacter(user.id, alt.id, input('Looted', true))).rejects.toThrow('outbox unavailable');
      expect(await db.character.findUnique({ where: { id: alt.id } })).toMatchObject({ raidRole: 'TANK' });
    } finally {
      await pool.query('DROP TRIGGER reject_job ON "OutboxJob"; DROP FUNCTION reject_job();');
    }
    expect(await db.character.findUnique({ where: { id: alt.id } })).not.toBeNull();
    expect(await removeCharacter(user.id, alt.id)).toMatchObject({ status: 200 });
    expect(await db.lootAward.findUnique({ where: { id: award.id } })).toMatchObject({ characterId: null, characterName: 'Looted' });
    expect(await db.reserve.count({ where: { characterId: alt.id } })).toBe(0);
    expect(await db.signup.findUnique({ where: { raidId_userId: { raidId: 'deletion', userId: user.id } } })).toMatchObject({ characterId: null });
    expect(await jobs()).toEqual(['deletion']);
    expect(await removeCharacter(user.id, alt.id)).toMatchObject({ status: 404, reason: 'not_found' });
    expect(await jobs()).toEqual(['deletion']);
    expect(await removeCharacter(user.id, user.characters[0].id)).toMatchObject({ status: 200 });
  });
});
