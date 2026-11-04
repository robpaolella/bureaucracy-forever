import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildPlan, confirmationCode, describePlan, main, parseArgs, pickSampleApplications, pickSampleMembers,
  SAMPLE_APPLICATION_PAIRS, SAMPLE_MEMBER_NAMES, type Dependents,
} from './cleanup-sample-members';
import { buildApplications, buildRoster } from './seed-data';

const roster = buildRoster();
const redtape = roster[1];
const member = (id: string, discordId: string, discordName: string) => ({ id, discordId, discordName });
const app = (id: string, discordId: string, discordName: string, character: string, decidedByUserId: string | null = null) => ({ id, discordId, discordName, character, decidedByUserId });
const none = (): Dependents => ({ characters: [], availability: [], signups: [], reserves: [], awards: [], notes: [], messages: [], interviews: [], decidedBySample: [], realNames: new Map() });

describe('seed name lists', () => {
  it('come from the seed builders, lowercased as the seed stores them', () => {
    expect(SAMPLE_MEMBER_NAMES.size).toBe(roster.length);
    expect(SAMPLE_MEMBER_NAMES.has('redtape')).toBe(true);
    expect(SAMPLE_APPLICATION_PAIRS.size).toBe(buildApplications().length);
    expect(SAMPLE_APPLICATION_PAIRS.has('stapler\u0000Stapler')).toBe(true);
  });
});

describe('pickSampleMembers', () => {
  it('selects only rows whose id and name both match, and reports one-sided matches as not sure', () => {
    const { sample, unsure } = pickSampleMembers([
      member('a', redtape.discordId, 'redtape'),
      member('b', '100000000099999999', 'someoneelse'),
      member('c', '123456789012345678', 'redtape'),
      member('d', '123456789012345678', 'someoneelse'),
      member('e', '1000000000123456789', 'redtape'), // 19 digits
    ]);
    expect(sample.map((m) => m.id)).toEqual(['a']);
    expect(unsure.map((u) => u.label)).toEqual(['someoneelse', 'redtape', 'redtape']);
    expect(unsure[0].reason).toMatch(/id looks like a sample id/);
    expect(unsure[1].reason).toMatch(/name is a sample name/);
  });

  it('matches every seeded member', () => {
    const rows = roster.map((m, i) => member(`u${i}`, m.discordId, m.name.toLowerCase()));
    expect(pickSampleMembers(rows).sample).toHaveLength(roster.length);
  });
});

describe('pickSampleApplications', () => {
  it('needs the 2000000000 id and a seeded (Discord name, character) pair', () => {
    const { sample, unsure } = pickSampleApplications([
      app('a', '200000000010000100', 'stapler', 'Stapler'),
      app('b', '200000000010000100', 'stapler', 'Notstapler'),
      app('c', '345678901234567890', 'stapler', 'Stapler'),
      app('d', '345678901234567890', 'someone', 'Someone'),
      app('e', '100000000010000100', 'stapler', 'Stapler'),
    ]);
    expect(sample.map((a) => a.id)).toEqual(['a']);
    expect(unsure.map((u) => u.label)).toEqual(['Notstapler', 'Stapler', 'Stapler']);
  });
});

describe('confirmationCode', () => {
  it('is stable for the same set in any order and changes when the set changes', () => {
    const code = confirmationCode(['user:a', 'user:b']);
    expect(code).toMatch(/^[0-9A-F]{8}$/);
    expect(confirmationCode(['user:b', 'user:a', 'user:a'])).toBe(code);
    expect(confirmationCode(['user:a'])).not.toBe(code);
    expect(confirmationCode(['user:a', 'user:b', 'signup:c'])).not.toBe(code);
  });
});

describe('buildPlan', () => {
  const sampleMember = member('s1', redtape.discordId, 'redtape');
  const sampleApp = app('a1', '200000000010000100', 'stapler', 'Stapler');

  it('deletes sample-owned rows, cascades included, and counts them per member and application', () => {
    const d = none();
    d.characters = [{ id: 'c1', userId: 's1', name: 'Redtape' }, { id: 'c2', userId: 's1', name: 'Blotter' }];
    d.availability = [{ userId: 's1' }];
    d.signups = [{ id: 'g1', userId: 's1', characterId: 'c1', setByUserId: null }];
    d.reserves = [{ id: 'r1', userId: 's1', characterId: 'c1', setById: null }];
    d.awards = [{ id: 'w1', userId: 's1', characterId: 'c1', characterName: 'Redtape', itemId: 1, recordedById: 's1', voidedById: 's1' }];
    d.notes = [{ id: 'n1', applicationId: 'real-app', authorId: 's1' }, { id: 'n2', applicationId: 'a1', authorId: 's1' }];
    d.messages = [{ id: 'm1', applicationId: 'a1', authorUserId: null }, { id: 'm2', applicationId: 'a1', authorUserId: 's1' }];
    d.interviews = [{ id: 'i1', applicationId: 'a1', requestedById: 's1', proposedById: null, bookedById: 's1', endedById: null }];
    const plan = buildPlan([sampleMember], [sampleApp], [], d);
    expect(plan.blocking).toEqual([]);
    expect(plan.members).toEqual([{ name: 'redtape', characters: 2, availability: 1, signups: 1, reserves: 1, awards: 1, notes: 1 }]);
    expect(plan.applications).toEqual([{ name: 'Stapler', notes: 1, messages: 2, interviews: 1 }]);
    // Notes on real applications and awards are deleted explicitly; the rest cascades.
    expect(plan.deletes).toEqual({ userIds: ['s1'], applicationIds: ['a1'], awardIds: ['w1'], noteIds: ['n1'] });
    expect(plan.rowIds).toHaveLength(13);
    expect(plan.totals).toMatchObject({ members: 1, characters: 2, notes: 2, messages: 2, interviews: 1 });
    expect(describePlan(plan)[0]).toBe('Sample members to delete: 1');
    expect(describePlan(plan, true)[0]).toBe('Sample members deleted: 1');
  });

  it('blocks on real-owned records pointing at sample rows', () => {
    const d = none();
    d.characters = [{ id: 'c1', userId: 's1', name: 'Redtape' }];
    d.awards = [
      { id: 'w1', userId: null, characterId: 'c1', characterName: 'Redtape', itemId: 19019, recordedById: 'real', voidedById: null },
      { id: 'w2', userId: 's1', characterId: 'c1', characterName: 'Redtape', itemId: 19019, recordedById: 's1', voidedById: 'real' },
    ];
    d.signups = [{ id: 'g1', userId: 'real', characterId: 'c1', setByUserId: null }];
    d.reserves = [
      { id: 'r1', userId: 's1', characterId: 'c1', setById: 'real' },
      { id: 'r2', userId: 'real', characterId: 'c1', setById: null },
    ];
    d.notes = [{ id: 'n1', applicationId: 'a1', authorId: 'real' }];
    d.messages = [{ id: 'm1', applicationId: 'a1', authorUserId: 'real' }];
    d.interviews = [{ id: 'i1', applicationId: 'a1', requestedById: 's1', proposedById: null, bookedById: null, endedById: 'real' }];
    d.realNames.set('real', 'officerbob');
    const plan = buildPlan([sampleMember], [sampleApp], [], d);
    expect(plan.blocking).toHaveLength(8);
    expect(plan.blocking.join('\n')).toContain('recorded by officerbob');
    expect(plan.blocking.join('\n')).toContain('voided by officerbob');
    expect(plan.blocking.join('\n')).toContain('raid signup by real member officerbob with sample character Redtape');
    expect(plan.deletes.awardIds).toEqual([]);
    for (const id of ['lootAward:w1', 'lootAward:w2', 'signup:g1', 'reserve:r1', 'reserve:r2', 'officerNote:n1', 'applicantMessage:m1', 'interview:i1']) expect(plan.rowIds).not.toContain(id);
    expect(describePlan(plan).join('\n')).toContain('Delete is refused');
  });

  it('lists pointers the database clears as information only', () => {
    const d = none();
    d.signups = [{ id: 'g1', userId: 's1', characterId: null, setByUserId: 'real' }, { id: 'g2', userId: 'real', characterId: null, setByUserId: 's1' }];
    d.decidedBySample = [{ id: 'ra', character: 'Realperson', decidedByUserId: 's1' }];
    d.realNames.set('real', 'officerbob');
    const plan = buildPlan([sampleMember], [{ ...sampleApp, decidedByUserId: 'real' }], [], d);
    expect(plan.blocking).toEqual([]);
    expect(plan.info).toHaveLength(4);
    expect(plan.rowIds).toContain('signup:g1');
    expect(plan.rowIds).not.toContain('signup:g2');
    expect(plan.members[0].signups).toBe(1);
  });
});

describe('parseArgs', () => {
  it('defaults to the dry run and needs a code to apply', () => {
    expect(parseArgs([])).toEqual({ apply: false });
    expect(parseArgs(['--apply', 'ab12cd34'])).toEqual({ apply: true, code: 'AB12CD34' });
    expect(parseArgs(['--apply=ab12cd34'])).toEqual({ apply: true, code: 'AB12CD34' });
    expect(parseArgs(['--apply'])).toHaveProperty('error');
    expect(parseArgs(['--apply='])).toHaveProperty('error');
    expect(parseArgs(['--apply', '--force'])).toHaveProperty('error');
    expect(parseArgs(['--apply', 'X', 'Y'])).toHaveProperty('error');
    expect(parseArgs(['--yes'])).toHaveProperty('error');
  });
});

describe('main', () => {
  it('refuses with one line and a non-zero exit when the database address is missing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main([], undefined)).toBe(1);
    expect(await main(['--apply', 'AB12CD34'], '  ')).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Set CLEANUP_DATABASE_URL'));
    error.mockRestore();
  });

  it('refuses apply without a code before touching the database', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main(['--apply'], 'postgresql://nobody@127.0.0.1:1/none')).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('confirmation code'));
    error.mockRestore();
  });

  it('reports an unreachable database in one line without the address', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main([], 'postgresql://nobody:secret@127.0.0.1:1/none')).toBe(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).toMatch(/^Could not reach the database/);
    expect(error.mock.calls[0][0]).not.toContain('secret');
    error.mockRestore();
  });
});

describe('the script source', () => {
  const source = readFileSync('prisma/cleanup-sample-members.ts', 'utf8');
  it('never reads settings files, the app client or the seed write guard', () => {
    expect(source).not.toMatch(/dotenv/);
    expect(source).not.toMatch(/['"`]\.env/);
    expect(source).not.toMatch(/readFile|existsSync|prisma\.config|lib\/db['"]|write-guard['"]/);
    expect(source).toMatch(/process\.env\.CLEANUP_DATABASE_URL/);
  });
});
