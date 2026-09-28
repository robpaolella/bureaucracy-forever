import { describe, expect, it } from 'vitest';
import { attendanceCandidates, groupByRole, signupsClosed, splitStanding, type DetailRow } from './raid-detail';

const row = (over: Partial<DetailRow>): DetailRow => ({
  userId: over.name ?? 'u',
  name: 'Redtape',
  character: 'Redtape',
  wowClass: 'warrior',
  spec: 'Protection',
  role: 'tank',
  standing: 'ROSTER',
  response: 'accept',
  attended: null,
  source: 'web',
  reason: null,
  setBy: null,
  updatedAt: '2026-11-19T00:00:00.000Z',
  ...over,
});

describe('groupByRole', () => {
  it('orders tank, healer, melee, ranged, then members without a main, dropping empty groups', () => {
    const groups = groupByRole([row({ name: 'Rangy', role: 'ranged' }), row({ name: 'Nomain', role: null, wowClass: null }), row({ name: 'Tanky', role: 'tank' }), row({ name: 'Healy', role: 'healer' })]);
    expect(groups.map((g) => g.role)).toEqual(['tank', 'healer', 'ranged', 'none']);
  });

  it('sorts accepted, tentative, unanswered, absent, then by name', () => {
    const [group] = groupByRole([row({ name: 'Zed', response: 'absent' }), row({ name: 'Bob', response: null }), row({ name: 'Cat', response: 'tentative' }), row({ name: 'Bea' }), row({ name: 'Al' })]);
    expect(group.rows.map((r) => r.name)).toEqual(['Al', 'Bea', 'Cat', 'Bob', 'Zed']);
  });
});

describe('splitStanding', () => {
  it('keeps unanswered roster rows on the roster and lists them separately', () => {
    const split = splitStanding([row({ name: 'Quiet', response: null }), row({ name: 'Benched', standing: 'BENCH' }), row({ name: 'In' })]);
    expect(split.roster.map((r) => r.name)).toEqual(['Quiet', 'In']);
    expect(split.bench.map((r) => r.name)).toEqual(['Benched']);
    expect(split.unanswered.map((r) => r.name)).toEqual(['Quiet']);
  });
});

describe('attendanceCandidates', () => {
  it('lists accepted and tentative from both standings, ticking accepted unless already recorded', () => {
    const c = attendanceCandidates([row({ name: 'A' }), row({ name: 'T', response: 'tentative' }), row({ name: 'B', standing: 'BENCH' }), row({ name: 'X', response: 'absent' }), row({ name: 'N', response: null }), row({ name: 'Skipped', attended: false })]);
    expect(c.map((x) => [x.row.name, x.checked])).toEqual([
      ['A', true],
      ['B', true],
      ['Skipped', false],
      ['T', false],
    ]);
  });
});

describe('signupsClosed', () => {
  const now = new Date('2026-11-20T02:30:00.000Z');
  it('closes on lock time, LOCKED status, cancellation or a finished raid', () => {
    expect(signupsClosed({ status: 'SCHEDULED', locksAt: '2026-11-20T03:00:00.000Z', cancelled: false }, false, now)).toBe(false);
    expect(signupsClosed({ status: 'SCHEDULED', locksAt: '2026-11-20T02:00:00.000Z', cancelled: false }, false, now)).toBe(true);
    expect(signupsClosed({ status: 'LOCKED', cancelled: false }, false, now)).toBe(true);
    expect(signupsClosed({ status: 'SCHEDULED', cancelled: true }, false, now)).toBe(true);
    expect(signupsClosed({ cancelled: false }, true, now)).toBe(true);
  });
});
