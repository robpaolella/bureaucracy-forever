import { describe, expect, it } from 'vitest';
import { monthCells, shiftMonth, sortNeedsAnswerFirst } from './calendar-grid';
import type { RaidCard } from './raids';

const card = (id: string, startsAt: string, over: Partial<RaidCard> = {}): RaidCard => ({ id, name: id, startsAt, durationMin: 180, notes: null, cancelled: false, requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 }, counts: { tank: 0, healer: 0, melee: 0, ranged: 0 }, mine: null, status: 'SCHEDULED', ...over });

describe('month grid', () => {
  it('starts on Monday, marks today, and files a raid under the viewer’s own day', () => {
    // Thu 5 Nov 2026 8 PM Pacific is Fri 6 Nov 04:00Z: a Thursday in Los Angeles, a Friday in London.
    const raid = card('r', '2026-11-06T04:00:00.000Z');
    const now = new Date('2026-11-01T12:00:00.000Z');
    const la = monthCells(2026, 11, [raid], 'America/Los_Angeles', now);
    expect(la[0].map((c) => c.day)).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(la.flat().find((c) => c.raids.length)?.day).toBe(5);
    expect(la.flat().find((c) => c.today)?.day).toBe(1);
    const london = monthCells(2026, 11, [raid], 'Europe/London', now);
    expect(london.flat().find((c) => c.raids.length)?.day).toBe(6);
    expect(la.length).toBeLessThanOrEqual(6);
  });

  it('sorts raids that need the viewer’s answer first', () => {
    const a = card('a', '2026-11-01T00:00:00.000Z', { onRoster: true, mine: 'accept' });
    const b = card('b', '2026-11-08T00:00:00.000Z', { onRoster: true, mine: null });
    const c = card('c', '2026-11-03T00:00:00.000Z', { onRoster: false, mine: null });
    expect(sortNeedsAnswerFirst([a, b, c]).map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('shifts months across the year edge', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
