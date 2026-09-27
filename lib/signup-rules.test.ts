import { describe, expect, it } from 'vitest';
import { countsForBars, decideBench, decideRespond, REASONS, type RaidState } from './signup-rules';

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

  it('bars count roster acceptances only', () => {
    expect(
      countsForBars([
        { standing: 'ROSTER', response: 'accept', role: 'tank' },
        { standing: 'ROSTER', response: 'tentative', role: 'tank' },
        { standing: 'BENCH', response: 'accept', role: 'healer' },
        { standing: 'ROSTER', response: 'accept', role: null },
      ]),
    ).toEqual({ tank: 1, healer: 0, melee: 0, ranged: 0 });
  });
});
