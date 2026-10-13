import { describe, expect, it } from 'vitest';
import { applyOperation, parseOperation, samePayload, type HeldAward, type LootState, type Operation, type SiteEnv } from './addon-operations';

// The worked examples of ADDON-SPEC.md section 4.3 (sample data).
const RAID = 'cm9xr2k4a0001';
const AWARD = { type: 'award', id: 'aw-7f3k2m9q', formatVersion: 1, raid: RAID, env: 'staging', boss: 'lb_lucifron', item: 16805, char: 'Ana Vale', user: 'u_ana', method: 'HR', roll: 91, sender: 'Rae Quill', at: 1792001200 };
const CONFIRM = { type: 'confirm', id: 'cf-1x8p4d2s', formatVersion: 1, raid: RAID, env: 'staging', key: 'aw-7f3k2m9q', at: 1792001204 };
const VOID = { type: 'void', id: 'vd-5b2n8c1w', formatVersion: 1, raid: RAID, env: 'staging', key: 'aw-7f3k2m9q', reason: 'wrong winner', at: 1792001260 };
const NEW_AWARD = { type: 'award', id: 'aw-2h6j9z4b', formatVersion: 1, raid: RAID, env: 'staging', boss: 'lb_lucifron', item: 16805, char: 'Bo Marsh', user: 'u_bo', method: 'SR', roll: 77, sender: 'Rae Quill', at: 1792001300 };
const REPLACE = { type: 'replace', id: 'rp-9c4v6t0e', formatVersion: 1, raid: RAID, env: 'staging', key: 'aw-7f3k2m9q', at: 1792001300, award: NEW_AWARD };
const PRACTICE = { type: 'award', id: 'aw-4t1y7g5k', formatVersion: 1, raid: RAID, env: 'staging', practice: true, boss: 'lb_trash', item: 17011, char: 'Dee Holt', method: 'OPEN_ROLL', roll: 12, sender: 'Rae Quill', at: 1792001400 };

function op(input: Record<string, unknown>): Operation {
  const parsed = parseOperation(input);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}
const fresh = (raidId = RAID): LootState => ({ raidId, awards: new Map(), receipts: new Map() });
let clock = 0;
function run(state: LootState, input: Record<string, unknown>, env: SiteEnv = 'staging', officerId = 'officer-1') {
  return applyOperation(state, op(input), { env }, { officerId, now: new Date(1_800_000_000_000 + clock++ * 1000) });
}
const award = (state: LootState, key = AWARD.id) => state.awards.get(key);
const loggedAward = (raidId = RAID): HeldAward => ({ raidId, voided: false, confirmation: 'CONFIRMED', confirmedAt: null });

describe('parseOperation', () => {
  it('reads every worked example in the spec', () => {
    for (const example of [AWARD, CONFIRM, VOID, REPLACE, PRACTICE, { ...CONFIRM, type: 'not-confirmed', id: 'nc-00000001' }]) expect(parseOperation(example).ok).toBe(true);
    expect(op(AWARD)).toMatchObject({ practice: false, note: null });
    expect(op(PRACTICE)).toMatchObject({ practice: true, user: null });
  });

  it('drops unknown fields and normalises blanks, so equal operations compare equal', () => {
    expect(op({ ...VOID, extra: 1, reason: '  ' })).toEqual(op({ ...VOID, reason: undefined }));
    expect(op({ ...AWARD, method: 'DISENCHANT_BANK', char: 'Ana Vale' })).toMatchObject({ char: null, user: null });
  });

  it('answers a version it does not know with unsupported-version', () => {
    expect(parseOperation({ ...AWARD, formatVersion: 2 })).toMatchObject({ ok: false, code: 'unsupported-version' });
    expect(parseOperation({ ...AWARD, formatVersion: '1' })).toEqual({ ok: false, error: 'Bad format version.' });
  });

  it.each([
    ['a short id', { id: 'short' }],
    ['another environment word', { env: 'dev' }],
    ['a practice mark that is not true or false', { practice: 'yes' }],
    ['no game time', { at: undefined }],
    ['an item that is not a whole number', { item: 1.5 }],
    ['an unknown method', { method: 'NEED' }],
    ['no winner', { char: '' }],
    ['a roll over 100', { roll: 101 }],
    ['a note over 200 characters', { note: 'x'.repeat(201) }],
    ['no sender', { sender: undefined }],
    ['an unknown type', { type: 'delete' }],
  ])('refuses %s', (_, change) => {
    expect(parseOperation({ ...AWARD, ...change }).ok).toBe(false);
  });

  it('refuses a correction with no key, or a replacement whose new award reuses a key', () => {
    expect(parseOperation({ ...VOID, key: undefined }).ok).toBe(false);
    expect(parseOperation({ ...VOID, reason: 'x'.repeat(201) }).ok).toBe(false);
    expect(parseOperation({ ...REPLACE, award: { ...NEW_AWARD, id: AWARD.id } }).ok).toBe(false);
    expect(parseOperation({ ...REPLACE, award: VOID }).ok).toBe(false);
  });
});

describe('samePayload', () => {
  it('ignores the times, which the site only stores, and the order of fields', () => {
    expect(samePayload(op(AWARD), op({ ...AWARD, at: 1 }))).toBe(true);
    expect(samePayload(op(REPLACE), op({ ...REPLACE, award: { ...NEW_AWARD, at: 5 } }))).toBe(true);
    const reordered = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(op(AWARD)).reverse())));
    expect(samePayload(op(AWARD), reordered)).toBe(true);
    expect(samePayload(op(AWARD), op({ ...AWARD, roll: 90 }))).toBe(false);
  });
});

// One test per row of the table in ADDON-SPEC section 4.2, with its outcome word.
describe('arrival order (ADDON-SPEC section 4.2)', () => {
  it('award | nothing | Recorded (recorded)', () => {
    const state = fresh();
    const { outcome, changes } = run(state, AWARD);
    expect(outcome).toEqual({ status: 'recorded' });
    expect(changes.map((c) => c.kind)).toEqual(['receipt', 'award']);
    expect(changes[1]).toMatchObject({ award: { id: AWARD.id, sender: 'Rae Quill' }, recordedById: 'officer-1' });
    expect(award(state)).toMatchObject({ voided: false, confirmation: 'ANNOUNCED' });
  });

  it('void | its award | Award marked void (voided)', () => {
    const state = fresh();
    run(state, AWARD);
    const { outcome, changes } = run(state, VOID, 'staging', 'officer-2');
    expect(outcome).toEqual({ status: 'voided' });
    expect(changes[1]).toMatchObject({ kind: 'void', key: AWARD.id, voidedById: 'officer-2', reason: 'wrong winner' });
    expect(award(state)?.voided).toBe(true);
  });

  it('void | nothing | Kept as a pending void (pending)', () => {
    const state = fresh();
    const { outcome, changes } = run(state, VOID);
    expect(outcome).toEqual({ status: 'pending' });
    expect(changes).toEqual([{ kind: 'receipt', receipt: expect.objectContaining({ status: 'PENDING' }) }]);
    expect(award(state)).toBeUndefined();
  });

  it('award | a pending void for its key | Recorded already void (voided)', () => {
    const state = fresh();
    run(state, VOID, 'staging', 'officer-2');
    const { outcome, changes } = run(state, AWARD);
    expect(outcome).toEqual({ status: 'voided' });
    expect(changes.map((c) => c.kind)).toEqual(['receipt', 'award', 'applied', 'void']);
    expect(changes[3]).toMatchObject({ voidedById: 'officer-2', reason: 'wrong winner' });
    expect(state.receipts.get(VOID.id)?.status).toBe('APPLIED');
    // A void always wins over a later upload of the same award.
    expect(run(state, AWARD).outcome).toEqual({ status: 'replayed' });
    expect(award(state)?.voided).toBe(true);
  });

  it('award | the same award (same id, same payload) | Nothing changes (replayed)', () => {
    const state = fresh();
    run(state, AWARD);
    expect(run(state, { ...AWARD, at: AWARD.at + 30 }, 'staging', 'officer-2')).toEqual({ outcome: { status: 'replayed' }, changes: [] });
  });

  it('award | the same id with a different payload | Rejected (rejected, key-conflict); nothing changes', () => {
    const state = fresh();
    run(state, AWARD);
    const before = structuredClone(state);
    expect(run(state, { ...AWARD, char: 'Bo Marsh', user: 'u_bo' })).toEqual({ outcome: { status: 'rejected', code: 'key-conflict' }, changes: [] });
    expect(state).toEqual(before);
  });

  it('void | the same void again | replayed', () => {
    const state = fresh();
    run(state, AWARD);
    run(state, VOID);
    expect(run(state, VOID)).toEqual({ outcome: { status: 'replayed' }, changes: [] });
    const pendingOnly = fresh();
    run(pendingOnly, VOID);
    expect(run(pendingOnly, VOID).outcome).toEqual({ status: 'replayed' });
  });

  it('void | its award, already voided by another void | voided; the first void stands', () => {
    const state = fresh();
    run(state, AWARD);
    run(state, VOID);
    const { outcome, changes } = run(state, { ...VOID, id: 'vd-second01', reason: 'changed mind' });
    expect(outcome).toEqual({ status: 'voided' });
    expect(changes.map((c) => c.kind)).toEqual(['receipt']);
  });

  it('confirm / not-confirmed | its award (any state) | updated by the later game time; a voided award stays void', () => {
    const state = fresh();
    run(state, AWARD);
    expect(run(state, CONFIRM).outcome).toEqual({ status: 'recorded' });
    expect(award(state)).toMatchObject({ confirmation: 'CONFIRMED', confirmedAt: CONFIRM.at });
    // An earlier "not confirmed" arriving later loses.
    expect(run(state, { ...CONFIRM, type: 'not-confirmed', id: 'nc-earlier1', at: CONFIRM.at - 1 }).changes.map((c) => c.kind)).toEqual(['receipt']);
    expect(award(state)?.confirmation).toBe('CONFIRMED');
    run(state, VOID);
    run(state, { ...CONFIRM, type: 'not-confirmed', id: 'nc-later001', at: CONFIRM.at + 10 });
    expect(award(state)).toMatchObject({ confirmation: 'NOT_CONFIRMED', voided: true });
  });

  it('confirm / not-confirmed on the same game time: confirmed wins, whichever arrives first', () => {
    for (const order of [['confirm', 'not-confirmed'], ['not-confirmed', 'confirm']]) {
      const state = fresh();
      run(state, AWARD);
      order.forEach((type, i) => run(state, { ...CONFIRM, type, id: `cf-tie0000${i}` }));
      expect(award(state)?.confirmation).toBe('CONFIRMED');
    }
  });

  it('confirm / not-confirmed | nothing | Kept pending, applied when the award arrives', () => {
    const state = fresh();
    expect(run(state, CONFIRM).outcome).toEqual({ status: 'pending' });
    const { outcome, changes } = run(state, AWARD);
    expect(outcome).toEqual({ status: 'recorded' });
    expect(changes.map((c) => c.kind)).toEqual(['receipt', 'award', 'applied', 'confirmation']);
    expect(award(state)?.confirmation).toBe('CONFIRMED');
  });

  it('replace | its original | Original voided, new award recorded (recorded)', () => {
    const state = fresh();
    run(state, AWARD);
    const { outcome, changes } = run(state, REPLACE, 'staging', 'officer-2');
    expect(outcome).toEqual({ status: 'recorded' });
    expect(changes.map((c) => c.kind)).toEqual(['receipt', 'void', 'receipt', 'award']);
    expect(changes[1]).toMatchObject({ key: AWARD.id, reason: null });
    expect(changes[3]).toMatchObject({ award: { id: NEW_AWARD.id }, recordedById: 'officer-2' });
    expect(award(state)?.voided).toBe(true);
    expect(award(state, NEW_AWARD.id)?.voided).toBe(false);
    // The new award uploaded on its own later is the same record.
    expect(run(state, NEW_AWARD).outcome).toEqual({ status: 'replayed' });
  });

  it('replace | nothing | Kept pending like a void (pending); the new award is recorded when the original arrives', () => {
    const state = fresh();
    expect(run(state, REPLACE).outcome).toEqual({ status: 'pending' });
    expect(award(state, NEW_AWARD.id)).toBeUndefined();
    const { outcome, changes } = run(state, AWARD);
    expect(outcome).toEqual({ status: 'voided' });
    expect(changes.map((c) => c.kind)).toEqual(['receipt', 'award', 'applied', 'void', 'receipt', 'award']);
    expect(award(state, NEW_AWARD.id)?.voided).toBe(false);
  });
});

describe('arrival order, beyond the table', () => {
  it('a pending replacement carries the corrections that arrived for its new award', () => {
    const state = fresh();
    run(state, REPLACE);
    run(state, { ...VOID, id: 'vd-newaward', key: NEW_AWARD.id });
    run(state, AWARD);
    expect(award(state, NEW_AWARD.id)?.voided).toBe(true);
  });

  it('a replacement whose new award reuses a key with another payload is rejected', () => {
    const state = fresh();
    run(state, AWARD);
    run(state, { ...NEW_AWARD, roll: 1 });
    expect(run(state, REPLACE).outcome).toEqual({ status: 'rejected', code: 'key-conflict' });
    expect(award(state)?.voided).toBe(false);
  });

  it('every order of an award, its confirmation, a void and a replacement ends the same', () => {
    const ops = [AWARD, CONFIRM, { ...VOID, key: NEW_AWARD.id }, REPLACE];
    const orders = (xs: number[]): number[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x) => orders(xs.filter((y) => y !== x)).map((rest) => [x, ...rest])));
    const results = orders([0, 1, 2, 3]).map((order) => {
      const state = fresh();
      for (const i of order) run(state, ops[i]);
      return [...state.awards.entries()].sort();
    });
    expect(results).toHaveLength(24);
    for (const r of results) expect(r).toEqual(results[0]);
    expect(results[0]).toEqual([
      [NEW_AWARD.id, { raidId: RAID, voided: true, confirmation: 'ANNOUNCED', confirmedAt: null }],
      [AWARD.id, { raidId: RAID, voided: true, confirmation: 'CONFIRMED', confirmedAt: CONFIRM.at }],
    ]);
  });

  it('a correction can name an award typed into the loot log; an award cannot reuse its key', () => {
    const state = fresh();
    state.awards.set(AWARD.id, loggedAward());
    expect(run(state, { ...AWARD, at: 1 }).outcome).toEqual({ status: 'rejected', code: 'key-conflict' });
    expect(run(state, { ...CONFIRM, type: 'not-confirmed' }).outcome).toEqual({ status: 'recorded' });
    expect(award(state)?.confirmation).toBe('NOT_CONFIRMED');
    expect(run(state, VOID).outcome).toEqual({ status: 'voided' });
  });

  it('a key or id already used on another raid is rejected', () => {
    const state = fresh();
    state.awards.set(AWARD.id, loggedAward('another-raid'));
    expect(run(state, AWARD).outcome).toEqual({ status: 'rejected', code: 'key-conflict' });
    expect(run(state, VOID).outcome).toEqual({ status: 'rejected', code: 'key-conflict' });
    const other = fresh();
    other.receipts.set(CONFIRM.id, { op: op({ ...CONFIRM, raid: 'another-raid' }), status: 'PENDING', deliveredById: 'o', receivedAt: new Date() });
    expect(run(other, CONFIRM).outcome).toEqual({ status: 'rejected', code: 'key-conflict' });
  });
});

describe('raid, site and practice records (ADDON-SPEC section 2)', () => {
  it('refuses a record for the other site, or for a raid this batch is not for', () => {
    const state = fresh();
    expect(run(state, AWARD, 'production').outcome).toEqual({ status: 'rejected', code: 'wrong-environment' });
    expect(run(state, { ...AWARD, raid: 'another-raid' }).outcome).toEqual({ status: 'rejected', code: 'unknown-raid' });
    expect(run(state, { ...REPLACE, award: { ...NEW_AWARD, raid: 'another-raid' } }).outcome).toEqual({ status: 'rejected', code: 'unknown-raid' });
    expect(state.receipts.size).toBe(0);
  });

  it('refuses practice records in production, and records nothing', () => {
    const state = fresh();
    for (const practice of [PRACTICE, { ...VOID, practice: true }, { ...REPLACE, award: { ...NEW_AWARD, practice: true } }]) {
      expect(run(state, { ...practice, env: 'production', award: 'award' in practice ? { ...practice.award, env: 'production' } : undefined }, 'production').outcome)
        .toEqual({ status: 'rejected', code: 'practice-refused' });
    }
    expect(state.receipts.size).toBe(0);
    expect(run(state, { ...AWARD, env: 'production' }, 'production').outcome).toEqual({ status: 'recorded' });
  });

  it('accepts practice records for any raid on staging, keeping the mark', () => {
    for (const raidId of [RAID, 'deadmines-test-raid']) {
      const state = fresh(raidId);
      const { outcome, changes } = run(state, { ...PRACTICE, raid: raidId });
      expect(outcome).toEqual({ status: 'recorded' });
      expect(changes[1]).toMatchObject({ kind: 'award', award: { practice: true } });
    }
  });
});
