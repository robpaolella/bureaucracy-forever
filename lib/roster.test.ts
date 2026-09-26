import { describe, expect, it } from 'vitest';
import { countActiveFilters, EMPTY_FILTERS, filterRoster, formatAttendance, groupRoster, sortRoster, type RosterRow } from './roster';

const row = (name: string, extra: Partial<RosterRow> = {}): RosterRow => ({
  id: name,
  name,
  wowClass: 'warrior',
  spec: 'Fury',
  role: 'melee',
  rank: 'raider',
  attendance: 0.9,
  joinedAt: '2026-01-01T00:00:00Z',
  ...extra,
});

const ROWS: RosterRow[] = [
  row('Ledgerline', { rank: 'officer', role: 'tank', spec: 'Protection', attendance: 0.98, joinedAt: '2025-01-01T00:00:00Z' }),
  row('Redtape', { rank: 'officer', wowClass: 'priest', role: 'healer', spec: 'Holy', attendance: 0.95 }),
  row('Binder', { wowClass: 'mage', role: 'ranged', spec: 'Frost', attendance: 0.7, joinedAt: '2026-09-01T00:00:00Z' }),
  row('Addendum', { rank: 'trial', wowClass: 'mage', role: 'ranged', spec: 'Fire', attendance: null, joinedAt: '2026-09-20T00:00:00Z' }),
  row('Quorum', { rank: 'social', wowClass: 'druid', role: 'healer', spec: 'Restoration', attendance: 0 }),
];

describe('filterRoster', () => {
  it('matches name substrings case-insensitively and combines filters with AND', () => {
    expect(filterRoster(ROWS, { ...EMPTY_FILTERS, search: 'RED' }).map((r) => r.name)).toEqual(['Redtape']);
    expect(filterRoster(ROWS, { ...EMPTY_FILTERS, classes: ['mage'] }).map((r) => r.name)).toEqual(['Binder', 'Addendum']);
    expect(filterRoster(ROWS, { ...EMPTY_FILTERS, classes: ['mage'], rank: 'trial' }).map((r) => r.name)).toEqual(['Addendum']);
    expect(filterRoster(ROWS, { ...EMPTY_FILTERS, roles: ['healer', 'tank'] }).length).toBe(3);
    expect(filterRoster(ROWS, EMPTY_FILTERS).length).toBe(5);
  });

  it('counts active filters, ignoring whitespace-only search', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ search: '  ', classes: ['mage'], roles: [], rank: 'trial' })).toBe(2);
  });
});

describe('sortRoster', () => {
  it('defaults to rank high to low, then name', () => {
    expect(sortRoster(ROWS, 'rank', 'asc').map((r) => r.name)).toEqual(['Ledgerline', 'Redtape', 'Binder', 'Addendum', 'Quorum']);
    expect(sortRoster(ROWS, 'rank', 'desc').map((r) => r.name)).toEqual(['Quorum', 'Addendum', 'Binder', 'Ledgerline', 'Redtape']);
  });

  it('sorts by name, attendance and joined date with unknown attendance last', () => {
    expect(sortRoster(ROWS, 'name', 'asc').map((r) => r.name)).toEqual(['Addendum', 'Binder', 'Ledgerline', 'Quorum', 'Redtape']);
    expect(sortRoster(ROWS, 'attendance', 'desc').map((r) => r.name)).toEqual(['Ledgerline', 'Redtape', 'Binder', 'Quorum', 'Addendum']);
    expect(sortRoster(ROWS, 'attendance', 'asc').map((r) => r.name)).toEqual(['Quorum', 'Binder', 'Redtape', 'Ledgerline', 'Addendum']);
    expect(sortRoster(ROWS, 'joinedAt', 'desc').map((r) => r.name)[0]).toBe('Addendum');
    expect(sortRoster(ROWS, 'joinedAt', 'asc').map((r) => r.name)[0]).toBe('Ledgerline');
  });

  it('does not mutate its input', () => {
    const copy = [...ROWS];
    sortRoster(ROWS, 'name', 'desc');
    expect(ROWS).toEqual(copy);
  });
});

describe('groupRoster', () => {
  const classLabel = (c: string) => c[0].toUpperCase() + c.slice(1);
  const roleLabel = (r: string) => r.toUpperCase();

  it('keeps flat as one unnamed group', () => {
    const g = groupRoster(ROWS, 'flat', classLabel, roleLabel);
    expect(g).toHaveLength(1);
    expect(g[0].rows).toHaveLength(5);
  });

  it('groups by role in tank, healer, melee, ranged order and drops empty roles', () => {
    const g = groupRoster(ROWS, 'role', classLabel, roleLabel);
    expect(g.map((x) => [x.label, x.rows.length])).toEqual([
      ['TANK', 1],
      ['HEALER', 2],
      ['RANGED', 2],
    ]);
  });

  it('groups by class alphabetically by label', () => {
    expect(groupRoster(ROWS, 'class', classLabel, roleLabel).map((x) => x.label)).toEqual(['Druid', 'Mage', 'Priest', 'Warrior']);
  });
});

it('formats attendance', () => {
  expect(formatAttendance(0.946)).toBe('95%');
  expect(formatAttendance(0)).toBe('0%');
  expect(formatAttendance(null)).toBe('—');
});
