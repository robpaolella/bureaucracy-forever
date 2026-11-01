import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/lib/generated/prisma/client';

const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock('@/lib/db', () => ({ get db() { return state.db; } }));
vi.mock('@/lib/session', () => ({ getSession: async () => ({ discordId: 'officer', role: 'officer' }) }));
import { addAlt, addMain, changeMain, editCharacter, removeCharacter } from './characters';
import { POST as officerAddMain } from '@/app/api/roster/route';
import { PUT as botSetMain } from '@/app/api/bot/members/[discordId]/main/route';
import { POST as botAddAlt } from '@/app/api/bot/members/[discordId]/characters/route';
import { DELETE as botRemoveAlt } from '@/app/api/bot/members/[discordId]/characters/[characterId]/route';

const input = (name: string, healer = false) => ({ name, wowClass: 'paladin', spec: healer ? 'Holy' : 'Protection', role: healer ? 'healer' : 'tank' });

// CHARACTERS_INTEGRATION=1 npx vitest run lib/characters.integration.test.ts
// Like signup-character.test.ts, owns a disposable loopback-only Postgres, never an existing DB.
describe.skipIf(process.env.CHARACTERS_INTEGRATION !== '1')('character rules on PostgreSQL', () => {
  let container: string, pool: Pool, db: PrismaClient;
  const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();
  const member = (id: string, main = true) => db.user.create({ data: {
    id, discordId: id, discordName: id, rank: 'RAIDER',
    characters: main ? { create: { name: `${id} Main`, class: 'PALADIN', spec: 'Protection', raidRole: 'TANK' } } : undefined,
  }, include: { characters: true } });
  const raid = (id: string, userId: string, characterId: string | null, posted = true, status: 'SCHEDULED' | 'LOCKED' | 'DONE' = 'SCHEDULED') => db.raid.create({ data: {
    id, name: id, startsAt: new Date('2099-06-01'), locksAt: new Date('2099-06-01'), requirements: {},
    discordThreadId: posted ? id : null, status,
    signups: { create: { userId, characterId, response: 'ACCEPT', source: 'WEB' } },
  } });
  const jobs = async () => (await db.outboxJob.findMany({ where: { type: 'raid.update' } })).map((j) => (j.payload as { raidId: string }).raidId).sort();
  /** member.classes.sync payloads for one Discord id, oldest first. */
  const classJobs = async (discordId: string) => (await db.outboxJob.findMany({ where: { type: 'member.classes.sync' }, orderBy: { createdAt: 'asc' } }))
    .map((j) => j.payload as { discordId: string; classes: string[]; main: boolean }).filter((p) => p.discordId === discordId);

  // Both real transactions finish the selected read before either can write; retries do not wait.
  async function race<T>(changes: (() => Promise<T>)[], model: 'User' | 'Character' = 'User') {
    let arrived = 0, release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const timer = setTimeout(release, 5000);
    state.db = db.$extends({ query: { $allModels: { async $allOperations({ model: queriedModel, operation, args, query }) {
      const result = await query(args);
      if (queriedModel === model && operation === 'findUnique' && ++arrived <= 2) {
        if (arrived === 2) release();
        await ready;
        if (arrived < 2) throw new Error('Concurrent transactions did not overlap');
      }
      return result;
    } } } }) as unknown as PrismaClient;
    try { return await Promise.all(changes.map((run) => run())); }
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
    const added = await addAlt('Adder', { ...input('Second Alt'), rank: 'officer' });
    expect(added).toMatchObject({ status: 201, character: { isMain: false, rank: 'RAIDER', name: 'Second Alt' } });
    expect(await addAlt('Adder', input('sEcOnD aLt', true))).toMatchObject({ status: 200, character: { spec: 'Protection' } });
    expect(await db.character.count({ where: { userId: 'Adder' } })).toBe(2);
    expect(await addAlt('Adder', input('aDdEr mAiN'))).toEqual({ status: 409, reason: 'name_taken', error: 'You already have a character with that name.' });
    await member('Other');
    expect(await addAlt('Other', input('SECOND ALT'))).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
  });
  it('rejects missing members, missing mains and invalid fields', async () => {
    expect(await addAlt('missing', input('Valid Name'))).toEqual({ status: 404, reason: 'not_found', error: 'No such member.' });
    await member('Empty', false);
    expect(await addAlt('Empty', input('Valid Name'))).toEqual({ status: 409, reason: 'no_main', error: 'Set a main first.' });
    for (const bad of [{ name: '1' }, { wowClass: 'bad' }, { spec: 'bad' }, { role: 'ranged' }]) {
      expect(await addAlt('Empty', { ...input('Valid Name'), ...bad })).toMatchObject({ status: 400, reason: 'invalid' });
    }
  });
  it('two simultaneous adds at seven leave eight; a ninth is refused, a retry still works', async () => {
    await member('Capped');
    for (const name of ['One Alt', 'Two Alt', 'Three Alt', 'Four Alt', 'Five Alt', 'Six Alt']) await addAlt('Capped', input(name));
    const results = await race(['Race One', 'Race Two'].map((name) => () => addAlt('Capped', input(name))));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)).toEqual({ status: 409, reason: 'limit', error: 'You can have up to 8 characters.' });
    expect(await db.character.count({ where: { userId: 'Capped' } })).toBe(8);
    expect(await addAlt('Capped', input('Ninth Alt'))).toEqual({ status: 409, reason: 'limit', error: 'You can have up to 8 characters.' });
    expect(await addAlt('Capped', input('One Alt'))).toMatchObject({ status: 200 });
  });
  it('resolves concurrent same-name adds as a retry or other-member collision', async () => {
    await member('Racer'); await member('Rival');
    const same = await race([() => addAlt('Racer', input('Shared Name')), () => addAlt('Racer', input('SHARED NAME'))]);
    expect(same.map((r) => r.status).sort()).toEqual([200, 201]);
    const different = await race([() => addAlt('Racer', input('Contested Name')), () => addAlt('Rival', input('CONTESTED NAME'))]);
    expect(different.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(different.find((r) => r.status === 409)).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
  });
  it('edits safely and refreshes only chosen posted active raids, with null choices for mains', async () => {
    const user = await member('Editor');
    const added = await addAlt(user.id, input('Editable Alt'));
    if (!('character' in added)) throw new Error('Expected alt');
    const alt = added.character, main = user.characters[0];
    await raid('alt-choice', user.id, alt.id); await raid('locked-choice', user.id, alt.id, true, 'LOCKED');
    await raid('main-choice', user.id, main.id); await raid('null-choice', user.id, null);
    await raid('unposted', user.id, alt.id, false); await raid('completed', user.id, alt.id, true, 'DONE');
    expect(await editCharacter(user.id, alt.id, input('EDITOR MAIN'))).toEqual({ status: 409, reason: 'name_taken', error: 'You already have a character with that name.' });
    expect(await editCharacter(user.id, alt.id, input('OTHER MAIN'))).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
    expect(await editCharacter('Other', alt.id, input('Stolen Name'))).toMatchObject({ status: 404, reason: 'not_found' });
    expect(await editCharacter(user.id, alt.id, { ...input('Editable Alt', true), rank: 'officer' })).toMatchObject({ status: 200, character: { rank: 'RAIDER' } });
    expect(await jobs()).toEqual(['alt-choice', 'locked-choice']);
    await db.outboxJob.deleteMany();
    await editCharacter(user.id, alt.id, input('Renamed Alt', true));
    expect(await jobs()).toEqual([]);
    await editCharacter(user.id, main.id, input('Editor Main', true));
    expect(await jobs()).toEqual(['main-choice', 'null-choice']);
    await db.outboxJob.deleteMany();
  });
  it('swaps mains, mirrors officer rank and preserves explicit and legacy raid choices', async () => {
    const user = await member('Switcher'), oldMain = user.characters[0];
    const added = await addAlt(user.id, input('New Main', true));
    if (!('character' in added)) throw new Error('Expected alt');
    const alt = added.character;
    await db.user.update({ where: { id: user.id }, data: { rank: 'OFFICER' } });
    const memberStats = { joinedAt: new Date('2020-01-01'), attendance: 87.5 };
    await db.character.update({ where: { id: oldMain.id }, data: memberStats });
    await db.character.update({ where: { id: alt.id }, data: { joinedAt: new Date('2025-01-01'), attendance: 10 } });
    for (const [id, choice, status] of [
      ['swap-past-null', null, 'DONE'], ['swap-future-null', null, 'SCHEDULED'],
      ['swap-past-main', oldMain.id, 'DONE'], ['swap-future-main', oldMain.id, 'SCHEDULED'],
      ['swap-future-alt', alt.id, 'LOCKED'],
    ] as const) {
      await raid(id, user.id, choice, true, status);
      if (status === 'DONE') await db.raid.update({ where: { id }, data: { startsAt: new Date('2020-01-01') } });
    }
    const jobsBefore = await jobs();
    expect(await changeMain(alt.id)).toMatchObject({ status: 200, character: { id: alt.id, isMain: true, rank: 'OFFICER', raidRole: 'HEALER' } });
    expect(await db.character.findUnique({ where: { id: alt.id } })).toMatchObject(memberStats);
    expect(await db.character.findUnique({ where: { id: oldMain.id } })).toMatchObject({ isMain: false, raidRole: 'TANK', ...memberStats });
    expect(await db.character.count({ where: { userId: user.id, isMain: true } })).toBe(1);
    const signups = await db.signup.findMany({ where: { userId: user.id }, orderBy: { raidId: 'asc' } });
    expect(signups.map((s) => [s.raidId, s.characterId])).toEqual([
      ['swap-future-alt', alt.id], ['swap-future-main', oldMain.id], ['swap-future-null', oldMain.id],
      ['swap-past-main', oldMain.id], ['swap-past-null', oldMain.id],
    ]);
    const characters = await db.character.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    expect(await changeMain(alt.id)).toMatchObject({ status: 200 });
    expect(await db.character.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } })).toEqual(characters);
    expect(await db.signup.findMany({ where: { userId: user.id }, orderBy: { raidId: 'asc' } })).toEqual(signups);
    expect(await jobs()).toEqual(jobsBefore);
    expect(await changeMain('missing')).toMatchObject({ status: 404, reason: 'not_found' });
    // #170/#174: an earlier read of this alt cannot authorize edits/deletion after promotion.
    expect(await editCharacter(user.id, alt.id, input('Forbidden Name'), { altOnly: true })).toMatchObject({ status: 409, reason: 'main' });
    expect(await db.character.findUnique({ where: { id: alt.id } })).toMatchObject({ name: 'New Main', raidRole: 'HEALER' });
    expect(await editCharacter(user.id, oldMain.id, input('Demoted Alt'), { altOnly: true })).toMatchObject({ status: 200 });
    expect(await removeCharacter(user.id, alt.id, { altOnly: true })).toMatchObject({ status: 409, reason: 'main' });
    expect(await removeCharacter(user.id, oldMain.id, { altOnly: true })).toMatchObject({ status: 200 });
    expect(await removeCharacter(user.id, alt.id, { altOnly: true })).toMatchObject({ status: 409, reason: 'main' });
    await db.outboxJob.deleteMany();
  });
  it('rolls back pinned signups and demotion when promotion fails', async () => {
    const user = await member('Rollback');
    const added = await addAlt(user.id, input('Rollback Alt'));
    if (!('character' in added)) throw new Error('Expected alt');
    await raid('rollback-null', user.id, null);
    await pool.query(`CREATE FUNCTION reject_promotion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW."isMain" AND NOT OLD."isMain" THEN RAISE EXCEPTION 'promotion unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_promotion BEFORE UPDATE ON "Character" FOR EACH ROW EXECUTE FUNCTION reject_promotion();`);
    try {
      await expect(changeMain(added.character.id)).rejects.toThrow('promotion unavailable');
      expect(await db.character.findUnique({ where: { id: user.characters[0].id } })).toMatchObject({ isMain: true });
      expect(await db.character.findUnique({ where: { id: added.character.id } })).toMatchObject({ isMain: false });
      expect(await db.signup.findUnique({ where: { raidId_userId: { raidId: 'rollback-null', userId: user.id } } })).toMatchObject({ characterId: null });
    } finally {
      await pool.query('DROP TRIGGER reject_promotion ON "Character"; DROP FUNCTION reject_promotion();');
    }
  });
  it('concurrent swaps leave exactly one main and keep the original legacy choice', async () => {
    const user = await member('Swapracer');
    const alts = [await addAlt(user.id, input('Swap One')), await addAlt(user.id, input('Swap Two'))];
    const ids = alts.map((r) => { if (!('character' in r)) throw new Error('Expected alt'); return r.character.id; });
    await raid('race-null', user.id, null);
    const results = await race(ids.map((id) => () => changeMain(id)), 'Character');
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await db.character.count({ where: { userId: user.id, isMain: true } })).toBe(1);
    expect(await db.signup.findUnique({ where: { raidId_userId: { raidId: 'race-null', userId: user.id } } })).toMatchObject({ characterId: user.characters[0].id });
  });
  it('adds a main with the member\'s rank; retries, second mains and name clashes', async () => {
    const user = await member('Mainless', false);
    await db.user.update({ where: { id: user.id }, data: { rank: 'TRIAL' } });
    expect(await addMain(user.id, { ...input('First Main'), rank: 'officer', isMain: false })).toMatchObject({ status: 201, character: { isMain: true, rank: 'TRIAL', name: 'First Main' } });
    expect(await addMain(user.id, input('fIrSt mAiN', true))).toMatchObject({ status: 200, character: { name: 'First Main', spec: 'Protection' } });
    expect(await addMain(user.id, input('Second Main'))).toEqual({ status: 409, reason: 'has_main', error: 'You already have a main.' });
    expect(await db.character.count({ where: { userId: user.id } })).toBe(1);
    await member('Clasher', false);
    expect(await addMain('Clasher', input('FIRST MAIN'))).toEqual({ status: 409, reason: 'name_taken', error: 'That name is taken by another member.' });
    expect(await addMain('missing', input('Valid Name'))).toEqual({ status: 404, reason: 'not_found', error: 'No such member.' });
    // Defensive: an own alt (no main) with that name is a clash, not a retry.
    await db.character.create({ data: { userId: 'Clasher', name: 'Orphan Alt', class: 'PALADIN', spec: 'Protection', raidRole: 'TANK', isMain: false } });
    expect(await addMain('Clasher', input('orphan alt'))).toEqual({ status: 409, reason: 'name_taken', error: 'You already have a character with that name.' });
  });
  it('two add-main requests at once leave one main', async () => {
    await member('Doublemain', false);
    const results = await race([() => addMain('Doublemain', input('Double One')), () => addMain('Doublemain', input('Double Two'))]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)).toEqual({ status: 409, reason: 'has_main', error: 'You already have a main.' });
    expect(await db.character.count({ where: { userId: 'Doublemain', isMain: true } })).toBe(1);
    expect(await db.character.count({ where: { userId: 'Doublemain' } })).toBe(1);
  });
  it('add-main racing an officer giving the same member a main leaves one main', async () => {
    await member('Contested', false);
    const officer = async () => (await officerAddMain(new Request('http://localhost/api/roster', {
      method: 'POST', body: JSON.stringify({ userId: 'Contested', ...input('Officer Pick'), rank: 'raider' }),
    }))).status;
    const [mine, theirs] = await race<number>([async () => (await addMain('Contested', input('Member Pick'))).status, officer]);
    expect([mine, theirs].sort()).toEqual([201, 409]);
    expect(await db.character.count({ where: { userId: 'Contested', isMain: true } })).toBe(1);
    expect(await db.character.count({ where: { userId: 'Contested' } })).toBe(1);
  });
  it('removes an alt with loot, cascades reserves, falls back signups and queues refresh atomically', async () => {
    const user = await member('Remover');
    const added = await addAlt(user.id, input('Looted Alt'));
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
      await expect(editCharacter(user.id, alt.id, input('Looted Alt', true))).rejects.toThrow('outbox unavailable');
      expect(await db.character.findUnique({ where: { id: alt.id } })).toMatchObject({ raidRole: 'TANK' });
    } finally {
      await pool.query('DROP TRIGGER reject_job ON "OutboxJob"; DROP FUNCTION reject_job();');
    }
    expect(await db.character.findUnique({ where: { id: alt.id } })).not.toBeNull();
    expect(await removeCharacter(user.id, alt.id)).toMatchObject({ status: 200 });
    expect(await db.lootAward.findUnique({ where: { id: award.id } })).toMatchObject({ characterId: null, characterName: 'Looted Alt' });
    expect(await db.reserve.count({ where: { characterId: alt.id } })).toBe(0);
    expect(await db.signup.findUnique({ where: { raidId_userId: { raidId: 'deletion', userId: user.id } } })).toMatchObject({ characterId: null });
    expect(await jobs()).toEqual(['deletion']);
    expect(await removeCharacter(user.id, alt.id)).toMatchObject({ status: 404, reason: 'not_found' });
    expect(await jobs()).toEqual(['deletion']);
    expect(await removeCharacter(user.id, user.characters[0].id)).toMatchObject({ status: 200 });
  });

  it('queues member.classes.sync with each change that touches a class or the main, and with nothing else', async () => {
    const user = await member('Classer');
    const mage = await addAlt(user.id, { name: 'Mage Alt', wowClass: 'mage', spec: 'Frost', role: 'ranged' });
    if (!('character' in mage)) throw new Error('Expected alt');
    expect(await classJobs('Classer')).toEqual([{ discordId: 'Classer', classes: ['mage'], main: false }]);
    // Repeats, renames and refusals queue nothing.
    await addAlt(user.id, { name: 'MAGE ALT', wowClass: 'mage', spec: 'Frost', role: 'ranged' });
    await editCharacter(user.id, mage.character.id, { name: 'Renamed Mage', wowClass: 'mage', spec: 'Fire', role: 'ranged' });
    await changeMain(user.characters[0].id);
    await removeCharacter(user.id, user.characters[0].id);
    expect(await classJobs('Classer')).toHaveLength(1);
    await editCharacter(user.id, user.characters[0].id, { name: 'Classer Main', wowClass: 'warrior', spec: 'Protection', role: 'tank' });
    await changeMain(mage.character.id);
    await removeCharacter(user.id, user.characters[0].id);
    expect((await classJobs('Classer')).slice(1)).toEqual([
      { discordId: 'Classer', classes: ['paladin', 'warrior'], main: true },
      { discordId: 'Classer', classes: ['mage', 'warrior'], main: true },
      { discordId: 'Classer', classes: ['warrior'], main: false },
    ]);
  });
  it('a change whose job fails rolls back, and a rolled-back change queues no job', async () => {
    const user = await member('Atomic');
    await pool.query(`CREATE FUNCTION reject_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'outbox unavailable'; END $$;
      CREATE TRIGGER reject_job BEFORE INSERT ON "OutboxJob" FOR EACH ROW EXECUTE FUNCTION reject_job();`);
    try {
      await expect(addAlt(user.id, input('Lost Alt'))).rejects.toThrow('outbox unavailable');
      await expect(editCharacter(user.id, user.characters[0].id, { ...input('Atomic Main'), wowClass: 'warrior' })).rejects.toThrow('outbox unavailable');
    } finally {
      await pool.query('DROP TRIGGER reject_job ON "OutboxJob"; DROP FUNCTION reject_job();');
    }
    expect(await db.character.findMany({ where: { userId: user.id }, select: { name: true, class: true } })).toEqual([{ name: 'Atomic Main', class: 'PALADIN' }]);
    const added = await addAlt(user.id, input('Kept Alt'));
    if (!('character' in added)) throw new Error('Expected alt');
    await pool.query(`CREATE FUNCTION reject_promotion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW."isMain" AND NOT OLD."isMain" THEN RAISE EXCEPTION 'promotion unavailable'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_promotion BEFORE UPDATE ON "Character" FOR EACH ROW EXECUTE FUNCTION reject_promotion();`);
    try {
      await expect(changeMain(added.character.id)).rejects.toThrow('promotion unavailable');
    } finally {
      await pool.query('DROP TRIGGER reject_promotion ON "Character"; DROP FUNCTION reject_promotion();');
    }
    expect(await classJobs('Atomic')).toEqual([{ discordId: 'Atomic', classes: ['paladin'], main: false }]);
  });
  it('racing changes retried after a serialization failure leave exactly one job', async () => {
    await member('Jobracer');
    const same = await race([() => addAlt('Jobracer', input('Raced Alt')), () => addAlt('Jobracer', input('RACED ALT'))]);
    expect(same.map((r) => r.status).sort()).toEqual([200, 201]);
    expect(await classJobs('Jobracer')).toEqual([{ discordId: 'Jobracer', classes: ['paladin'], main: false }]);
    await member('Mainracer', false);
    const mains = await race([() => addMain('Mainracer', input('Main One')), () => addMain('Mainracer', input('Main Two'))]);
    expect(mains.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await classJobs('Mainracer')).toEqual([{ discordId: 'Mainracer', classes: ['paladin'], main: true }]);
  });
  it('the bot\'s character routes queue a job per change, and an Idempotency-Key replay queues none', async () => {
    vi.stubEnv('BOT_SHARED_SECRET', 'test-secret');
    const discordId = '100000000000000501';
    await db.user.create({ data: { id: 'Botmember', discordId, discordName: 'Botmember', rank: 'RAIDER' } });
    const bot = (path: string, method: string, key: string, body?: object) => new Request(`http://localhost/api/bot/members/${discordId}${path}`, {
      method, headers: { authorization: 'Bearer test-secret', 'idempotency-key': key }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const druid = { firstName: 'Bot', secondName: 'Druid', wowClass: 'druid', spec: 'Feral', raidRole: 'tank' };
    const params = Promise.resolve({ discordId });
    try {
      for (let i = 0; i < 2; i++) expect((await botSetMain(bot('/main', 'PUT', 'set-druid', druid), { params })).status).toBe(200);
      // Same class, new spec: nothing for Discord to change.
      expect((await botSetMain(bot('/main', 'PUT', 'respec', { ...druid, spec: 'Balance', raidRole: 'ranged' }), { params })).status).toBe(200);
      // "Set my main" from Druid to Warrior lists only the new class, so the Druid tag stays.
      expect((await botSetMain(bot('/main', 'PUT', 'set-warrior', { ...druid, wowClass: 'warrior', spec: 'Protection', raidRole: 'tank' }), { params })).status).toBe(200);
      const alt = { name: 'Bot Mage', wowClass: 'mage', spec: 'Frost', raidRole: 'ranged' };
      const first = await botAddAlt(bot('/characters', 'POST', 'add-mage', alt), { params });
      expect(first.status).toBe(201);
      expect((await botAddAlt(bot('/characters', 'POST', 'add-mage', alt), { params })).headers.get('Idempotent-Replay')).toBe('true');
      const { character } = await first.json() as { character: { id: string } };
      const removeParams = { params: Promise.resolve({ discordId, characterId: character.id }) };
      for (let i = 0; i < 2; i++) expect((await botRemoveAlt(bot(`/characters/${character.id}`, 'DELETE', 'remove-mage'), removeParams)).status).toBe(204);
      expect((await botRemoveAlt(bot(`/characters/${character.id}`, 'DELETE', 'remove-again'), removeParams)).status).toBe(204);
      expect(await classJobs(discordId)).toEqual([
        { discordId, classes: ['druid'], main: true },
        { discordId, classes: ['warrior'], main: true },
        { discordId, classes: ['mage'], main: false },
        { discordId, classes: ['mage'], main: false },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
