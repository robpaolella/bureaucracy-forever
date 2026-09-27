import { describe, expect, it } from 'vitest';
import { zonedParts } from './time';
import { instanceName, isRosterRank, missingOccurrences, occurrences } from './series';

describe('series occurrences', () => {
  // Thursday 8 PM Pacific, four weeks, starting Wednesday 14 Oct 2026 (PDT).
  const series = { weekday: 4, startTime: '20:00', horizonWeeks: 4 };
  const from = new Date('2026-10-14T17:00:00.000Z');

  it('keeps 8 PM at 8 PM Pacific on both sides of the 1 Nov 2026 fall-back', () => {
    const dates = occurrences(series, from);
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-10-16T03:00:00.000Z', // Thu 15 Oct, PDT (UTC−7)
      '2026-10-23T03:00:00.000Z', // Thu 22 Oct
      '2026-10-30T03:00:00.000Z', // Thu 29 Oct
      '2026-11-06T04:00:00.000Z', // Thu 5 Nov, PST (UTC−8): the instant moves, the wall clock does not
    ]);
    for (const d of dates) {
      const p = zonedParts(d, 'America/Los_Angeles');
      expect([p.weekday, p.hour, p.minute]).toEqual([4, 20, 0]);
    }
  });

  it('includes today when the time has not passed and skips it once it has', () => {
    const thursdayMorning = new Date('2026-10-15T15:00:00.000Z'); // Thu 8 AM PDT
    expect(occurrences({ ...series, horizonWeeks: 1 }, thursdayMorning)[0].toISOString()).toBe('2026-10-16T03:00:00.000Z');
    const thursdayNight = new Date('2026-10-16T04:00:00.000Z'); // Thu 9 PM PDT
    expect(occurrences({ ...series, horizonWeeks: 1 }, thursdayNight)[0].toISOString()).toBe('2026-10-23T03:00:00.000Z');
  });

  it('handles a Sunday series and the spring-forward day', () => {
    // Sunday 7 PM Pacific across 8 Mar 2026 (spring forward).
    const sunday = occurrences({ weekday: 0, startTime: '19:00', horizonWeeks: 2 }, new Date('2026-03-02T12:00:00.000Z'));
    // Sun 8 Mar 7 PM is already PDT (UTC−7): 02:00Z on 9 Mar; the week before would have been 03:00Z.
    expect(sunday.map((d) => d.toISOString())).toEqual(['2026-03-09T02:00:00.000Z', '2026-03-16T02:00:00.000Z']);
    expect(zonedParts(sunday[1], 'America/Los_Angeles').hour).toBe(19);
  });

  it('reports which occurrences still need a raid', () => {
    const wanted = occurrences(series, from);
    expect(missingOccurrences(wanted, [wanted[0], wanted[2]]).map((d) => d.toISOString())).toEqual([wanted[1], wanted[3]].map((d) => d.toISOString()));
  });

  it('names instances and knows the roster ranks', () => {
    expect(instanceName('Molten Core', new Date('2026-10-16T03:00:00.000Z'))).toBe('Molten Core — Thu Oct 15');
    expect(isRosterRank('RAIDER') && isRosterRank('TRIAL') && isRosterRank('OFFICER')).toBe(true);
    expect(isRosterRank('SOCIAL')).toBe(false);
  });
});
