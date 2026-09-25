import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatClockShort,
  formatRange,
  formatRangeShort,
  formatRealmRange,
  formatRealmRangeShort,
  formatUtcOffset,
  minutesBetween,
  nextOccurrence,
  parseHHMM,
  tzOffsetMs,
  zoneAbbreviation,
  zonedTimeToUtc,
} from './time';

const CHI = 'America/Chicago';
const LA = 'America/Los_Angeles';
const LON = 'Europe/London';

describe('zonedTimeToUtc', () => {
  it('8:00 PM Chicago is 6:00 PM Los Angeles during US DST', () => {
    const t = zonedTimeToUtc(2026, 9, 29, 20, 0, CHI);
    expect(formatClock(t, LA)).toBe('6:00 PM');
    expect(formatClock(t, CHI)).toBe('8:00 PM');
  });

  it('follows each zone through its own DST change', () => {
    // London leaves DST on 25 Oct 2026; Chicago on 1 Nov 2026. The gap moves for a week.
    const before = zonedTimeToUtc(2026, 10, 21, 20, 0, CHI);
    const between = zonedTimeToUtc(2026, 10, 28, 20, 0, CHI);
    const after = zonedTimeToUtc(2026, 11, 4, 20, 0, CHI);
    expect(formatClock(before, LON)).toBe('2:00 AM');
    expect(formatClock(between, LON)).toBe('1:00 AM');
    expect(formatClock(after, LON)).toBe('2:00 AM');
  });

  it('moves a nonexistent spring-forward time past the gap', () => {
    // Chicago jumps 02:00 → 03:00 on 8 March 2026; 02:30 never happens.
    const t = zonedTimeToUtc(2026, 3, 8, 2, 30, CHI);
    expect(formatClock(t, CHI)).toBe('3:30 AM');
    expect(t.toISOString()).toBe('2026-03-08T08:30:00.000Z');
  });

  it('resolves an ambiguous fall-back time to the earlier instant', () => {
    // Chicago repeats 01:00–02:00 on 1 November 2026.
    const t = zonedTimeToUtc(2026, 11, 1, 1, 30, CHI);
    expect(t.toISOString()).toBe('2026-11-01T06:30:00.000Z'); // CDT, the first pass
    expect(formatClock(t, CHI)).toBe('1:30 AM');
  });

  it('rejects out-of-range wall times', () => {
    expect(() => parseHHMM('24:00')).toThrow();
    expect(() => parseHHMM('12:60')).toThrow();
    expect(() => parseHHMM('8pm')).toThrow();
    expect(parseHHMM('23:59')).toEqual({ hour: 23, minute: 59 });
  });

  it('reports offsets with the right sign', () => {
    const summer = new Date('2026-07-01T12:00:00Z');
    expect(tzOffsetMs(summer, CHI)).toBe(-5 * 3600_000);
    expect(tzOffsetMs(summer, LON)).toBe(1 * 3600_000);
    expect(tzOffsetMs(summer, 'UTC')).toBe(0);
  });
});

describe('nextOccurrence', () => {
  it('finds next Tuesday 8 PM realm time from a Wednesday', () => {
    const from = new Date('2026-09-30T12:00:00Z'); // a Wednesday
    const t = nextOccurrence(2, '20:00', CHI, from);
    expect(t.toISOString()).toBe('2026-10-07T01:00:00.000Z');
  });

  it('returns today when the time has not passed yet', () => {
    const from = new Date('2026-09-29T12:00:00Z'); // Tuesday 07:00 Chicago
    expect(nextOccurrence(2, '20:00', CHI, from).toISOString()).toBe('2026-09-30T01:00:00.000Z');
  });

  it('skips to next week when today’s time has passed', () => {
    const from = new Date('2026-09-30T02:00:00Z'); // Tuesday 21:00 Chicago
    expect(nextOccurrence(2, '20:00', CHI, from).toISOString()).toBe('2026-10-07T01:00:00.000Z');
  });

  it('uses the zone’s calendar, not the server’s', () => {
    // 03:00Z on Wednesday is still Tuesday evening in Los Angeles.
    const from = new Date('2026-09-30T03:00:00Z');
    expect(nextOccurrence(2, '21:00', LA, from).toISOString()).toBe('2026-09-30T04:00:00.000Z');
  });
});

describe('formatting', () => {
  it('drops the first period when both ends share it', () => {
    const s = zonedTimeToUtc(2026, 9, 29, 20, 0, CHI);
    const e = zonedTimeToUtc(2026, 9, 29, 23, 0, CHI);
    expect(formatRange(s, e, CHI)).toBe('8:00 – 11:00 PM');
    expect(formatRange(s, e, LA)).toBe('6:00 – 9:00 PM');
  });

  it('keeps both periods across noon', () => {
    const s = zonedTimeToUtc(2026, 9, 29, 11, 0, CHI);
    const e = zonedTimeToUtc(2026, 9, 29, 13, 0, CHI);
    expect(formatRange(s, e, CHI)).toBe('11:00 AM – 1:00 PM');
  });

  it('formats realm wall times without a date', () => {
    expect(formatRealmRange('20:00', '23:00')).toBe('8:00 – 11:00 PM');
    expect(formatRealmRange('19:00', '22:00')).toBe('7:00 – 10:00 PM');
  });

  it('drops :00 in short ranges but keeps other minutes', () => {
    const s = zonedTimeToUtc(2026, 9, 29, 20, 0, CHI);
    const e = zonedTimeToUtc(2026, 9, 29, 23, 0, CHI);
    expect(formatRangeShort(s, e, CHI)).toBe('8 – 11 PM');
    expect(formatRangeShort(s, e, LA)).toBe('6 – 9 PM');
    expect(formatClockShort(zonedTimeToUtc(2026, 9, 29, 19, 50, CHI), CHI)).toBe('7:50 PM');
    expect(formatRealmRangeShort('20:00', '23:00')).toBe('8 – 11 PM');
    expect(formatRealmRangeShort('19:30', '22:00')).toBe('7:30 – 10 PM');
  });

  it('formats UTC offsets with a real minus sign', () => {
    const summer = new Date('2026-07-01T12:00:00Z');
    expect(formatUtcOffset(summer, CHI)).toBe('UTC−5');
    expect(formatUtcOffset(summer, LON)).toBe('UTC+1');
    expect(formatUtcOffset(summer, 'Asia/Kolkata')).toBe('UTC+5:30');
    expect(formatUtcOffset(summer, 'UTC')).toBe('UTC+0');
  });

  it('measures a night in minutes', () => {
    expect(minutesBetween('20:00', '23:00')).toBe(180);
    expect(minutesBetween('19:00', '22:00')).toBe(180);
  });

  it('names zones', () => {
    expect(zoneAbbreviation(new Date('2026-09-29T00:00:00Z'), CHI)).toBe('CDT');
    expect(zoneAbbreviation(new Date('2026-12-29T00:00:00Z'), CHI)).toBe('CST');
  });
});
