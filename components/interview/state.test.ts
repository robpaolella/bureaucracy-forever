import { describe, expect, it } from 'vitest';
import { countHours, relativeDays, timesByDay } from './state';

// Eastern viewer, sample interview window from the approved design (Thu 15 Oct 2026).
const NY = 'America/New_York';
const LA = 'America/Los_Angeles';
const halfHours = (fromIso: string, count: number) => Array.from({ length: count }, (_, i) => new Date(Date.parse(fromIso) + i * 30 * 60_000).toISOString());

describe('timesByDay', () => {
  it("joins consecutive starts into runs that end 30 minutes after the last, by the viewer's day", () => {
    // 7:00–9:00 PM guild time on Thu 15 Oct is 10:00 PM–12:00 AM Eastern; 1:00–4:00 PM Eastern on Sat 17.
    const slots = [...halfHours('2026-10-16T02:00:00Z', 4), ...halfHours('2026-10-17T17:00:00Z', 6)];
    expect(timesByDay(slots.reverse(), NY)).toEqual([
      { day: 'Thursday 15 Oct', runs: [{ start: '2026-10-16T02:00:00.000Z', minutes: 120 }] },
      { day: 'Saturday 17 Oct', runs: [{ start: '2026-10-17T17:00:00.000Z', minutes: 180 }] },
    ]);
  });

  it("splits a run where the viewer's date changes and keeps gaps within a day apart", () => {
    // 8:30–10:00 PM guild time on Mon 19 Oct crosses midnight in New York.
    const evening = halfHours('2026-10-20T03:30:00Z', 3);
    expect(timesByDay(evening, NY).map((d) => d.day)).toEqual(['Monday 19 Oct', 'Tuesday 20 Oct']);
    expect(timesByDay(evening, LA)).toEqual([{ day: 'Monday 19 Oct', runs: [{ start: '2026-10-20T03:30:00.000Z', minutes: 90 }] }]);
    const gap = ['2026-10-17T17:00:00Z', '2026-10-17T19:00:00Z'];
    expect(timesByDay(gap, NY)[0].runs).toHaveLength(2);
  });

  it('ignores a repeated start', () => {
    expect(timesByDay(['2026-10-17T17:00:00Z', '2026-10-17T17:00:00.000Z'], NY)[0].runs).toEqual([{ start: '2026-10-17T17:00:00.000Z', minutes: 30 }]);
  });
});

describe('countHours', () => {
  it('counts an hour once whichever of its half-hour starts were sent', () => {
    expect(countHours([...halfHours('2026-10-16T02:00:00Z', 4), '2026-10-17T17:30:00Z'])).toBe(3);
    expect(countHours([])).toBe(0);
  });
});

describe('relativeDays', () => {
  const now = new Date('2026-10-15T22:15:00Z');
  it('reads today, tomorrow and in N days, and nothing once the time has passed by more than half a day', () => {
    expect(relativeDays('2026-10-16T02:00:00Z', now)).toBe('today');
    expect(relativeDays('2026-10-16T22:00:00Z', now)).toBe('tomorrow');
    expect(relativeDays('2026-10-18T02:00:00Z', now)).toBe('in 2 days');
    expect(relativeDays('2026-10-14T20:00:00Z', now)).toBeNull();
  });
});
