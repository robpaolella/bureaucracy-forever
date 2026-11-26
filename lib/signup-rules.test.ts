import { describe, expect, it } from 'vitest';
import { characterToBring, countsForBars, decideBench, decideRespond, isFirstAnswer, raidClosed, REASONS, type RaidState } from './signup-rules';

const now = new Date('2026-10-15T20:00:00.000Z');
const open: RaidState = { status: 'SCHEDULED', locksAt: new Date('2026-10-16T01:00:00.000Z') };
const member = { role: 'member' as const };

describe('sign-up rules', () => {
  it('refuses socials and closed raids with the reason the bot shows', () => {
    expect(decideRespond({ role: 'social' }, open, null, 'accept', now)).toEqual({ ok: false, status: 403, reason: REASONS.social });
    expect(decideRespond(member, { ...open, status: 'CANCELLED' }, null, 'accept', now)).toMatchObject({ status: 409, reason: REASONS.cancelled });
    expect(decideRespond(member, { ...open, status: 'DONE' }, null, 'accept', now)).toMatchObject({ status: 409, reason: REASONS.done });
    expect(decideRespond(member, { ...open, status: 'LOCKED' }, { standing: 'ROSTER', response: null }, 'accept', now)).toMatchObject({ status: 409, reason: REASONS.locked });
    expect(decideRespond(member, { ...open, locksAt: now }, { standing: 'ROSTER', response: null }, 'accept', now)).toMatchObject({ status: 409, reason: REASONS.locked });
  });

  it('lets roster members answer and benches everyone else who accepts', () => {
    expect(decideRespond(member, open, { standing: 'ROSTER', response: null }, 'absent', now)).toEqual({ ok: true, standing: 'ROSTER', response: 'absent' });
    expect(decideRespond(member, open, null, 'accept', now)).toEqual({ ok: true, standing: 'BENCH', response: 'accept' });
    expect(decideRespond(member, open, { standing: 'BENCH', response: 'accept' }, 'tentative', now)).toEqual({ ok: true, standing: 'BENCH', response: 'tentative' });
    expect(decideRespond(member, open, null, 'absent', now)).toMatchObject({ ok: false, status: 409, reason: REASONS.notOnRoster });
  });

  it('lets an officer override the lock on the web only', () => {
    const locked = { ...open, status: 'LOCKED' as const };
    expect(decideRespond({ role: 'officer' }, locked, { standing: 'ROSTER', response: null }, 'accept', now, true)).toMatchObject({ ok: true });
    expect(decideRespond({ role: 'officer' }, locked, { standing: 'ROSTER', response: null }, 'accept', now)).toMatchObject({ ok: false });
    expect(decideRespond({ role: 'officer' }, { ...open, status: 'DONE' }, { standing: 'ROSTER', response: null }, 'accept', now, true)).toMatchObject({ ok: false, reason: REASONS.done });
  });

  it('join bench is bench plus accept, refused for roster members', () => {
    expect(decideBench(member, open, null, now)).toEqual({ ok: true, standing: 'BENCH', response: 'accept' });
    expect(decideBench(member, open, { standing: 'ROSTER', response: 'absent' }, now)).toMatchObject({ ok: false, status: 409, reason: REASONS.alreadyRoster });
    expect(decideBench({ role: 'social' }, open, null, now)).toMatchObject({ status: 403 });
  });

  it('closes withdrawals after the lock unless an officer acts on the web', () => {
    const locked = { ...open, status: 'LOCKED' as const };
    expect(raidClosed(open, now, false)).toBeNull();
    expect(raidClosed(locked, now, false)).toMatchObject({ ok: false, status: 409, reason: REASONS.locked });
    expect(raidClosed({ ...open, locksAt: now }, now, false)).toMatchObject({ ok: false, reason: REASONS.locked });
    expect(raidClosed(locked, now, true)).toBeNull();
    expect(raidClosed({ ...open, status: 'DONE' }, now, true)).toMatchObject({ ok: false, reason: REASONS.done });
  });

  it('bars count roster acceptances only', () => {
    expect(
      countsForBars([
        { standing: 'ROSTER', response: 'accept', role: 'tank' },
        { standing: 'ROSTER', response: 'tentative', role: 'tank' },
        { standing: 'BENCH', response: 'accept', role: 'healer' },
        { standing: 'ROSTER', response: 'accept', role: null },
      ]),
    ).toEqual({ tank: 1, healer: 0, dps: 0 });
  });

  it('bars count melee and ranged roster acceptances as DPS, and never a tentative one', () => {
    expect(
      countsForBars([
        { standing: 'ROSTER', response: 'accept', role: 'melee' },
        { standing: 'ROSTER', response: 'accept', role: 'ranged' },
        { standing: 'ROSTER', response: 'tentative', role: 'ranged' },
        { standing: 'BENCH', response: 'accept', role: 'melee' },
        { standing: 'ROSTER', response: 'accept', role: 'unknown' },
      ]),
    ).toEqual({ tank: 0, healer: 0, dps: 2 });
  });
});

describe('the character an answer brings (#560)', () => {
  it('counts no answer, a withdrawn answer or Absent, followed by Accept/Tentative, as a first answer', () => {
    for (const previous of [null, 'absent'] as const) for (const next of ['accept', 'tentative'] as const) expect(isFirstAnswer(previous, next)).toBe(true);
    for (const previous of ['accept', 'tentative'] as const) for (const next of ['accept', 'tentative', 'absent'] as const) expect(isFirstAnswer(previous, next)).toBe(false);
    expect(isFirstAnswer(null, 'absent')).toBe(false);
  });
  it.each([
    ['first answer, character chosen', null, 'accept', 'chosen', 'default', 'chosen'],
    ['first answer after Absent, character chosen', 'absent', 'tentative', 'chosen', null, 'chosen'],
    ['first answer, none chosen, default set', null, 'tentative', null, 'default', 'default'],
    ['first answer after Absent, none chosen, default set', 'absent', 'accept', null, 'default', 'default'],
    ['first answer, none chosen, no default: keep (row or main)', null, 'accept', null, null, null],
    ['Accept to Tentative: unchanged', 'accept', 'tentative', null, 'default', null],
    ['Tentative to Accept: unchanged', 'tentative', 'accept', null, 'default', null],
    ['Accept to Absent: unchanged', 'accept', 'absent', null, 'default', null],
    ['Tentative to Absent: unchanged', 'tentative', 'absent', null, 'default', null],
    ['Absent again: unchanged', 'absent', 'absent', null, 'default', null],
    ['a chosen character on a later answer still switches', 'accept', 'tentative', 'chosen', 'default', 'chosen'],
  ] as const)('%s', (_name, previous, next, chosen, fallback, expected) => {
    expect(characterToBring(previous, next, chosen, fallback)).toBe(expected);
  });
});
