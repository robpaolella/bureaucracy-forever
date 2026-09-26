import { describe, expect, it } from 'vitest';
import {
  applyPaint,
  applyPaintRun,
  cellLabel,
  countStates,
  fmtSlot,
  isValidTimeZone,
  isWeek,
  normalizeWeek,
  offsetDescription,
  parseKey,
  relativeTime,
  serverOffsetSlots,
  weekDays,
  weekStart,
  type Week,
} from './availability';

describe('keys and validation', () => {
  it('parses valid keys and rejects the rest', () => {
    expect(parseKey('0:0')).toEqual({ day: 0, slot: 0 });
    expect(parseKey('6:47')).toEqual({ day: 6, slot: 47 });
    expect(parseKey('7:0')).toBeNull();
    expect(parseKey('0:48')).toBeNull();
    expect(parseKey('1:07')).toBeNull();
    expect(parseKey('a:b')).toBeNull();
  });

  it('accepts a well-formed week and rejects junk', () => {
    expect(isWeek({ '1:40': 'available', '2:41': 'if-needed' })).toBe(true);
    expect(isWeek({})).toBe(true);
    expect(isWeek({ '1:40': 'maybe' })).toBe(false);
    expect(isWeek({ '9:40': 'available' })).toBe(false);
    expect(isWeek([])).toBe(false);
    expect(isWeek(null)).toBe(false);
    expect(isWeek('1:40')).toBe(false);
  });

  it('normalizes by dropping invalid entries', () => {
    expect(normalizeWeek({ '1:40': 'available', bad: 'available', '2:2': 'nope' })).toEqual({ '1:40': 'available' });
    expect(normalizeWeek(null)).toEqual({});
  });
});

describe('painting', () => {
  const week: Week = { '1:40': 'available' };

  it('paints, repaints and erases immutably', () => {
    const a = applyPaint(week, '1:41', 'if-needed');
    expect(a).toEqual({ '1:40': 'available', '1:41': 'if-needed' });
    expect(week).toEqual({ '1:40': 'available' });
    expect(applyPaint(a, '1:41', 'erase')).toEqual({ '1:40': 'available' });
    expect(applyPaint(week, '1:40', 'available')).toBe(week); // no-op keeps identity
    expect(applyPaint(week, '3:3', 'erase')).toBe(week);
  });

  it('paints a run in either direction and clamps to the day', () => {
    const run = applyPaintRun({}, 2, 5, 3, 'available');
    expect(Object.keys(run).sort()).toEqual(['2:3', '2:4', '2:5']);
    expect(Object.keys(applyPaintRun({}, 0, 46, 60, 'if-needed')).sort()).toEqual(['0:46', '0:47']);
  });

  it('counts states', () => {
    expect(countStates({ '1:1': 'available', '1:2': 'available', '1:3': 'if-needed' })).toEqual({ available: 2, ifNeeded: 1 });
  });
});

describe('labels', () => {
  it('formats slots in 12-hour time and wraps past midnight', () => {
    expect(fmtSlot(0)).toBe('12:00 AM');
    expect(fmtSlot(1)).toBe('12:30 AM');
    expect(fmtSlot(24)).toBe('12:00 PM');
    expect(fmtSlot(41)).toBe('8:30 PM');
    expect(fmtSlot(48)).toBe('12:00 AM');
    expect(fmtSlot(-2)).toBe('11:00 PM');
    expect(cellLabel(1, 41)).toBe('Tue 8:30 PM');
  });

  it('describes the server offset', () => {
    expect(offsetDescription(4)).toBe('2 hours ahead');
    expect(offsetDescription(-2)).toBe('1 hour behind');
    expect(offsetDescription(0)).toBe('same time');
    expect(offsetDescription(11)).toBe('5½ hours ahead');
    expect(offsetDescription(1)).toBe('½ hours ahead');
  });

  it('formats relative time', () => {
    const now = new Date('2026-09-29T12:00:00Z');
    expect(relativeTime(new Date('2026-09-29T11:59:40Z'), now)).toBe('just now');
    expect(relativeTime(new Date('2026-09-29T11:56:00Z'), now)).toBe('4 minutes ago');
    expect(relativeTime(new Date('2026-09-29T09:00:00Z'), now)).toBe('3 hours ago');
    expect(relativeTime(new Date('2026-09-27T12:00:00Z'), now)).toBe('2 days ago');
  });
});

describe('week and offsets', () => {
  it('finds Monday 00:00 in the member’s zone', () => {
    // Wed 30 Sep 2026 12:00Z; Monday 28 Sep 00:00 in Los Angeles = 07:00Z
    expect(weekStart(new Date('2026-09-30T12:00:00Z'), 'America/Los_Angeles').toISOString()).toBe('2026-09-28T07:00:00.000Z');
    // Sunday evening in Chicago still belongs to the week that started the previous Monday
    expect(weekStart(new Date('2026-10-05T01:00:00Z'), 'America/Chicago').toISOString()).toBe('2026-09-28T05:00:00.000Z');
  });

  it('labels the seven columns with short dates and marks today', () => {
    const days = weekDays(new Date('2026-11-04T20:00:00Z'), 'America/Chicago'); // Wed 4 Nov
    expect(days.map((d) => d.date)).toEqual(['2 Nov', '3 Nov', '4 Nov', '5 Nov', '6 Nov', '7 Nov', '8 Nov']);
    expect(days.map((d) => d.name)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(days.find((d) => d.isToday)?.name).toBe('Wed');
  });

  it('measures how far the server clock is ahead, in half hours', () => {
    const summer = new Date('2026-09-29T12:00:00Z');
    expect(serverOffsetSlots(summer, 'America/Los_Angeles')).toBe(4);
    expect(serverOffsetSlots(summer, 'America/Chicago')).toBe(0);
    expect(serverOffsetSlots(summer, 'Europe/London')).toBe(-12);
    expect(serverOffsetSlots(summer, 'Asia/Kolkata')).toBe(-21);
  });

  it('validates timezones', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});
