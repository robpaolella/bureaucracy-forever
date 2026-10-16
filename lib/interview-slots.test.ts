import { describe, expect, it } from 'vitest';
import { isSlotStart, isValidStart, pickWindow, proposalRange, slotStartsBetween } from './interview-slots';
import { formatClock } from './time';

const at = (iso: string) => new Date(iso);
const pacific = (d: Date) => formatClock(d, 'America/Los_Angeles');

describe('isSlotStart', () => {
  it('takes half-hour starts from 9:00 AM to 10:30 PM Pacific', () => {
    // 2026-06-10 is PDT (UTC-7).
    expect(isSlotStart(at('2026-06-10T16:00:00Z'))).toBe(true); // 9:00 AM
    expect(isSlotStart(at('2026-06-10T16:30:00Z'))).toBe(true); // 9:30 AM
    expect(isSlotStart(at('2026-06-11T05:30:00Z'))).toBe(true); // 10:30 PM
  });

  it('refuses times outside the hours or off the half hour', () => {
    expect(isSlotStart(at('2026-06-10T15:30:00Z'))).toBe(false); // 8:30 AM
    expect(isSlotStart(at('2026-06-11T06:00:00Z'))).toBe(false); // 11:00 PM
    expect(isSlotStart(at('2026-06-10T16:15:00Z'))).toBe(false);
    expect(isSlotStart(at('2026-06-10T16:00:01Z'))).toBe(false);
    expect(isSlotStart(at('2026-06-10T16:00:00.500Z'))).toBe(false);
    expect(isSlotStart(new Date(Number.NaN))).toBe(false);
  });
});

describe('pickWindow', () => {
  it('runs from request + 2 h to request + 7 d, rounded inward to the half hour', () => {
    expect(pickWindow(at('2026-06-10T10:07:00Z'))).toEqual({
      windowStart: at('2026-06-10T12:30:00Z'),
      windowEnd: at('2026-06-17T10:00:00Z'),
    });
  });

  it('keeps edges already on the half hour', () => {
    expect(pickWindow(at('2026-06-10T10:30:00Z'))).toEqual({
      windowStart: at('2026-06-10T12:30:00Z'),
      windowEnd: at('2026-06-17T10:30:00Z'),
    });
  });

  it('rounds a stray millisecond inward too', () => {
    expect(pickWindow(at('2026-06-10T10:30:00.001Z'))).toEqual({
      windowStart: at('2026-06-10T13:00:00Z'),
      windowEnd: at('2026-06-17T10:30:00Z'),
    });
  });
});

describe('isValidStart', () => {
  // Requested 9:00 AM PDT, so picks run 11:00 AM PDT Jun 10 to 9:00 AM PDT Jun 17.
  const window = { kind: 'pick' as const, ...pickWindow(at('2026-06-10T16:00:00Z')) };

  it('takes picks on both window edges and refuses just outside', () => {
    expect(isValidStart(at('2026-06-10T18:00:00Z'), window)).toBe(true);
    expect(isValidStart(at('2026-06-10T17:30:00Z'), window)).toBe(false);
    expect(isValidStart(at('2026-06-17T16:00:00Z'), window)).toBe(true);
    expect(isValidStart(at('2026-06-17T16:30:00Z'), window)).toBe(false);
  });

  it('refuses a pick in the window that is not a slot', () => {
    expect(isValidStart(at('2026-06-12T07:00:00Z'), window)).toBe(false); // midnight
    expect(isValidStart(at('2026-06-12T18:10:00Z'), window)).toBe(false);
  });

  it('takes proposals from now + 2 h to now + 7 d', () => {
    const now = at('2026-06-10T16:00:00Z');
    expect(proposalRange(now)).toEqual({ from: at('2026-06-10T18:00:00Z'), to: at('2026-06-17T16:00:00Z') });
    const propose = { kind: 'propose' as const, now };
    expect(isValidStart(at('2026-06-10T18:00:00Z'), propose)).toBe(true);
    expect(isValidStart(at('2026-06-10T17:30:00Z'), propose)).toBe(false);
    expect(isValidStart(at('2026-06-17T16:00:00Z'), propose)).toBe(true);
    expect(isValidStart(at('2026-06-17T16:30:00Z'), propose)).toBe(false);
    // Off the half hour, now + 2 h is not a slot; the next one is.
    const odd = { kind: 'propose' as const, now: at('2026-06-10T16:10:00Z') };
    expect(isValidStart(at('2026-06-10T18:00:00Z'), odd)).toBe(false);
    expect(isValidStart(at('2026-06-10T18:30:00Z'), odd)).toBe(true);
  });

  it('books or accepts only when the start is at least 15 minutes away', () => {
    const start = at('2026-06-10T18:00:00Z');
    expect(isValidStart(start, { kind: 'book', now: at('2026-06-10T17:45:00Z') })).toBe(true);
    expect(isValidStart(start, { kind: 'book', now: at('2026-06-10T17:45:00.001Z') })).toBe(false);
    expect(isValidStart(start, { kind: 'book', now: at('2026-06-10T18:30:00Z') })).toBe(false);
    expect(isValidStart(at('2026-06-10T18:10:00Z'), { kind: 'book', now: at('2026-06-10T12:00:00Z') })).toBe(false);
  });
});

describe('slotStartsBetween', () => {
  it('lists 28 starts a day, 9:00 AM to 10:30 PM, edges included', () => {
    const day = slotStartsBetween(at('2026-06-10T16:00:00Z'), at('2026-06-11T05:30:00Z'));
    expect(day).toHaveLength(28);
    expect(pacific(day[0])).toBe('9:00 AM');
    expect(pacific(day[27])).toBe('10:30 PM');
    expect(day.every(isSlotStart)).toBe(true);
    expect(slotStartsBetween(at('2026-06-10T16:00:01Z'), at('2026-06-11T05:29:59Z'))).toHaveLength(26);
  });

  it('lists nothing for an empty or backwards range', () => {
    expect(slotStartsBetween(at('2026-06-11T07:00:00Z'), at('2026-06-11T15:59:00Z'))).toEqual([]);
    expect(slotStartsBetween(at('2026-06-11T16:00:00Z'), at('2026-06-10T16:00:00Z'))).toEqual([]);
  });

  it('lists every start in a seven-day pick window', () => {
    const { windowStart, windowEnd } = pickWindow(at('2026-06-10T16:00:00Z'));
    const starts = slotStartsBetween(windowStart, windowEnd);
    // Jun 10 from 11:00 AM (24), six full days (168), Jun 17 at 9:00 AM (1).
    expect(starts).toHaveLength(24 + 168 + 1);
    expect(starts.every((s) => isValidStart(s, { kind: 'pick', windowStart, windowEnd }))).toBe(true);
  });

  // 2026: clocks spring forward on Sunday 8 March and fall back on Sunday 1 November.
  it.each([
    ['March', '2026-03-06T08:00:00Z', '2026-03-11T08:00:00Z', ['2026-03-07T17:00:00Z', '2026-03-08T16:00:00Z']],
    ['November', '2026-10-30T07:00:00Z', '2026-11-04T08:00:00Z', ['2026-10-31T16:00:00Z', '2026-11-01T17:00:00Z']],
  ])('keeps 9:00 AM Pacific and 28 a day across the %s change', (_, from, to, nineAm) => {
    const starts = slotStartsBetween(at(from), at(to));
    expect(starts).toHaveLength(5 * 28);
    for (let day = 0; day < 5; day++) {
      const today = starts.slice(day * 28, day * 28 + 28);
      expect(pacific(today[0])).toBe('9:00 AM');
      expect(pacific(today[27])).toBe('10:30 PM');
    }
    // The UTC instant of 9:00 AM moves by an hour on the change day; the wall clock does not.
    for (const iso of nineAm) {
      expect(starts.map((s) => s.toISOString())).toContain(new Date(iso).toISOString());
      expect(isSlotStart(at(iso))).toBe(true);
    }
  });
});
