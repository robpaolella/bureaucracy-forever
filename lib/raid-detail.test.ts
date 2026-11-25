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
  it('orders tank, healer, DPS (melee and ranged together), then answered members without a main', () => {
    const groups = groupByRole([row({ name: 'Rangy', role: 'ranged' }), row({ name: 'Stabby', role: 'melee' }), row({ name: 'Nomain', role: null, wowClass: null }), row({ name: 'Tanky', role: 'tank' }), row({ name: 'Healy', role: 'healer' })]);
    expect(groups.map((g) => g.role)).toEqual(['tank', 'healer', 'dps', 'none']);
    expect(groups[2].rows.map((r) => r.name).sort()).toEqual(['Rangy', 'Stabby']);
  });

  it('keeps the three role groups even when empty, and drops "none" when nobody is in it', () => {
    expect(groupByRole([]).map((g) => [g.role, g.rows.length])).toEqual([['tank', 0], ['healer', 0], ['dps', 0]]);
  });

  it('holds only Accept and Tentative, accepted first then by name', () => {
    const [group] = groupByRole([row({ name: 'Zed', response: 'absent' }), row({ name: 'Bob', response: null }), row({ name: 'Cat', response: 'tentative' }), row({ name: 'Bea' }), row({ name: 'Al' })]);
    expect(group.rows.map((r) => r.name)).toEqual(['Al', 'Bea', 'Cat']);
  });

  it('keeps an answered member without a character visible', () => {
    const none = groupByRole([row({ name: 'Nomain', role: null, wowClass: null, character: null, response: 'tentative' })]).find((g) => g.role === 'none');
    expect(none?.rows.map((r) => r.name)).toEqual(['Nomain']);
  });
});

describe('splitStanding', () => {
  it('splits roster rows into No response and Absent, by name, and keeps bench rows out of both', () => {
    const split = splitStanding([
      row({ name: 'Quiet', response: null }),
      row({ name: 'Away', response: 'absent', reason: 'Family' }),
      row({ name: 'Benched', standing: 'BENCH' }),
      row({ name: 'BenchQuiet', standing: 'BENCH', response: null }),
      row({ name: 'BenchAway', standing: 'BENCH', response: 'absent' }),
      row({ name: 'Aaa', response: null }),
      row({ name: 'In' }),
    ]);
    expect(split.roster.map((r) => r.name)).toEqual(['Quiet', 'Away', 'Aaa', 'In']);
    expect(split.bench.map((r) => r.name).sort()).toEqual(['BenchAway', 'BenchQuiet', 'Benched']);
    expect(split.noResponse.map((r) => r.name)).toEqual(['Aaa', 'Quiet']);
    expect(split.absent.map((r) => r.name)).toEqual(['Away']);
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
