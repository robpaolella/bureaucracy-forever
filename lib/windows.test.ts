import { describe, expect, it } from 'vitest';
import { DEFAULT_MINIMA, findWindows, formatRoleMinima, scheduleHref, topWindows, type WindowCell } from './windows';

const zero = (): WindowCell => ({ total: 0, roles: { tank: 0, healer: 0, melee: 0, ranged: 0 } });
const grid = (): WindowCell[][] => Array.from({ length: 7 }, () => Array.from({ length: 48 }, zero));
const fill = (cells: WindowCell[][], day: number, from: number, to: number, cell: WindowCell) => {
  for (let s = from; s <= to; s++) cells[day][s] = { total: cell.total, roles: { ...cell.roles } };
};
const strong = { total: 30, roles: { tank: 3, healer: 9, melee: 10, ranged: 12 } };

describe('findWindows', () => {
  it('finds a window whose every slot meets every minimum, and nothing else', () => {
    const cells = grid();
    fill(cells, 1, 40, 45, strong); // Tue 20:00–23:00
    const found = findWindows(cells, 6, DEFAULT_MINIMA);
    expect(found).toEqual([{ day: 1, start: 40, length: 6, score: 30, roles: strong.roles }]);
    expect(findWindows(cells, 8, DEFAULT_MINIMA)).toEqual([]); // 4h does not fit in the painted 3h
    expect(findWindows(cells, 6, { ...DEFAULT_MINIMA, ranged: 13 })).toEqual([]);
  });

  it('scores by the weakest slot and reports the guaranteed role minima', () => {
    const cells = grid();
    fill(cells, 2, 36, 43, strong);
    cells[2][39] = { total: 22, roles: { tank: 2, healer: 8, melee: 9, ranged: 11 } }; // a dip
    const found = findWindows(cells, 6, DEFAULT_MINIMA);
    // Windows 36–41, 37–42 include the dip; 38–43 does too. All three qualify at the dip's numbers.
    expect(found.map((w) => [w.start, w.score])).toEqual([
      [36, 22],
      [37, 22],
      [38, 22],
    ]);
    expect(found[0].roles).toEqual({ tank: 2, healer: 8, melee: 9, ranged: 11 });
  });

  it('sorts by score, then day, then start', () => {
    const cells = grid();
    fill(cells, 3, 40, 45, strong);
    fill(cells, 1, 40, 45, { ...strong, total: 25 });
    fill(cells, 0, 40, 45, { ...strong, total: 25 });
    const found = findWindows(cells, 6, DEFAULT_MINIMA);
    expect(found.map((w) => w.day)).toEqual([3, 0, 1]);
  });
});

describe('topWindows', () => {
  it('keeps one window per day and caps the list at five', () => {
    const cells = grid();
    for (let d = 0; d < 7; d++) fill(cells, d, 36, 47, { ...strong, total: 40 - d });
    const all = findWindows(cells, 6, DEFAULT_MINIMA);
    expect(all.length).toBe(7 * 7); // 7 starts per day × 7 days
    const top = topWindows(all);
    expect(top.map((w) => w.day)).toEqual([0, 1, 2, 3, 4]);
    expect(top.every((w) => w.start === 36)).toBe(true);
  });
});

it('formats role minima the way the artboard does', () => {
  expect(formatRoleMinima(DEFAULT_MINIMA)).toBe('2T · 8H · 9M · 11R');
});

describe('scheduleHref', () => {
  it('shifts a viewer-local window to a guild-time weekday and start', () => {
    // Monday (day 0) 8:00 PM Chicago, 3 hours; guild time is 2 hours earlier.
    expect(scheduleHref(0, 40, 6, -4)).toBe('/members/calendar?new=1&day=1&time=18:00&length=180');
    // Sunday (day 6) 1:00 AM London is Saturday 5:00 PM guild time: crosses midnight backwards.
    expect(scheduleHref(6, 2, 4, -16)).toBe('/members/calendar?new=1&day=6&time=17:00&length=120');
    // Saturday 11:30 PM Kolkata is Saturday 10:00 AM guild; Sunday 11:00 PM Hawaii is Monday 1:00 AM guild.
    expect(scheduleHref(5, 47, 4, -27)).toBe('/members/calendar?new=1&day=6&time=10:00&length=120');
    expect(scheduleHref(6, 46, 4, 4)).toBe('/members/calendar?new=1&day=1&time=01:00&length=120');
  });
});
