import { describe, expect, it } from 'vitest';
import { zonedParts } from './time';
import { guildDateKey, instanceName, isRosterRank, missingOccurrences, occurrenceInWeekOf, occurrences, parseTitleAddition, raidNameError, skippedDatesFor, titleBase, fitTitleAddition } from './series';

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

  it('reports which occurrences still need a raid, matching by guild date rather than instant', () => {
    const wanted = occurrences(series, from);
    expect(missingOccurrences(wanted, [wanted[0], wanted[2]]).map((d) => d.toISOString())).toEqual([wanted[1], wanted[3]].map((d) => d.toISOString()));
    // A raid on that date at another time (the series moved from 8 PM to 7:30 PM) still counts as present.
    const moved = new Date(wanted[1].getTime() - 30 * 60_000);
    expect(missingOccurrences(wanted, [wanted[0], moved, wanted[2], wanted[3]])).toEqual([]);
    expect(guildDateKey(new Date('2026-11-20T04:00:00.000Z'))).toBe('2026-11-19');
  });

  it('never regenerates a guild date whose raid an officer deleted', () => {
    const wanted = occurrences(series, from);
    const deleted = guildDateKey(wanted[1]);
    expect(missingOccurrences(wanted, [wanted[0], wanted[2]], [deleted]).map((d) => d.toISOString())).toEqual([wanted[3].toISOString()]);
  });

  it('skips the week\'s own slot when the deleted instance had been moved to another day', () => {
    const wanted = occurrences(series, from);
    // Thu Oct 22 moved to Sat Oct 24 at 6 PM Pacific, then deleted.
    const moved = new Date('2026-10-25T01:00:00.000Z');
    expect(skippedDatesFor(wanted[1], series)).toEqual(['2026-10-22']);
    const skipped = skippedDatesFor(moved, series);
    expect(skipped).toEqual(['2026-10-24', '2026-10-22']);
    expect(missingOccurrences(wanted, [wanted[0], wanted[2], wanted[3]], skipped)).toEqual([]);
  });

  it('moves an instance to the series rule within its own guild week', () => {
    // Thu Nov 19 2026 8 PM PST → the same week's Friday at 7:30 PM PST.
    const thu = new Date('2026-11-20T04:00:00.000Z');
    expect(occurrenceInWeekOf(thu, { weekday: 5, startTime: '19:30' }).toISOString()).toBe('2026-11-21T03:30:00.000Z');
    // …or Sunday at 6 PM, which is earlier in the same week.
    expect(occurrenceInWeekOf(thu, { weekday: 0, startTime: '18:00' }).toISOString()).toBe('2026-11-16T02:00:00.000Z');
    // Across the fall-back: Thu Oct 29 8 PM PDT moved to Monday stays 8 PM wall clock (PDT still).
    expect(occurrenceInWeekOf(new Date('2026-10-30T03:00:00.000Z'), { weekday: 1, startTime: '20:00' }).toISOString()).toBe('2026-10-27T03:00:00.000Z');
  });

  it('names instances and knows the roster ranks', () => {
    expect(instanceName('Molten Core', new Date('2026-10-16T03:00:00.000Z'))).toBe('Molten Core — Thu Oct 15');
    expect(isRosterRank('RAIDER') && isRosterRank('TRIAL') && isRosterRank('OFFICER')).toBe(true);
    expect(isRosterRank('SOCIAL')).toBe(false);
  });

  it('puts a title addition after the template name, and leaves the plain title without one', () => {
    const tue = new Date('2026-11-25T04:00:00.000Z'); // Tue Nov 24, 8 PM PST
    expect(instanceName('Upper Blackrock Spire', tue, 'Key Run')).toBe('Upper Blackrock Spire: Key Run — Tue Nov 24');
    expect(instanceName('Upper Blackrock Spire', tue, null)).toBe('Upper Blackrock Spire — Tue Nov 24');
    expect(instanceName('Upper Blackrock Spire', tue, '')).toBe('Upper Blackrock Spire — Tue Nov 24');
    expect(titleBase('Upper Blackrock Spire', 'Key Run')).toBe('Upper Blackrock Spire: Key Run');
    // Late on the night of the fall-back (Sun Nov 1, 11:30 PM PST) is still Sunday in guild time.
    expect(instanceName('Molten Core', new Date('2026-11-02T07:30:00.000Z'), 'Alt Run')).toBe('Molten Core: Alt Run — Sun Nov 1');
    // …and the night before the spring-forward (Sat Mar 7 2026, 11 PM PST).
    expect(instanceName('Molten Core', new Date('2026-03-08T07:00:00.000Z'), 'Alt Run')).toBe('Molten Core: Alt Run — Sat Mar 7');
  });

  it('reads a title addition as typed: trimmed, spaces collapsed, blank as none', () => {
    expect(parseTitleAddition('  Key   Run  ')).toEqual({ ok: true, value: 'Key Run' });
    expect(parseTitleAddition('')).toEqual({ ok: true, value: null });
    expect(parseTitleAddition('   ')).toEqual({ ok: true, value: null });
    expect(parseTitleAddition(null)).toEqual({ ok: true, value: null });
    expect(parseTitleAddition(undefined)).toEqual({ ok: true, value: null });
    expect(parseTitleAddition('x'.repeat(40))).toEqual({ ok: true, value: 'x'.repeat(40) });
    expect(parseTitleAddition('x'.repeat(41))).toEqual({ ok: false, error: 'Keep the title addition to 40 characters.' });
    expect(parseTitleAddition('Key\nRun')).toEqual({ ok: false, error: 'Keep the title addition on one line.' });
    expect(parseTitleAddition('Key\tRun')).toEqual({ ok: false, error: 'Keep the title addition on one line.' });
    expect(parseTitleAddition(7)).toEqual({ ok: false, error: 'The title addition must be text.' });
  });

  it('refuses a full title over 100 characters, the thread-name limit', () => {
    const template = 'T'.repeat(60);
    const startsAt = new Date('2026-11-25T04:00:00.000Z'); // " — Tue Nov 24": 13 characters
    // 60 + ": " + 25 + 13 = 100 fits; one more does not.
    expect(raidNameError(template, 'a'.repeat(25), startsAt)).toBeNull();
    expect(raidNameError(template, 'a'.repeat(26), startsAt)).toMatch(/100 characters or fewer/);
    expect(raidNameError(template, null, startsAt)).toBeNull();
    // A series has no date yet, so it is held to the longest one.
    expect(raidNameError(template, 'a'.repeat(25))).toBeNull();
    expect(raidNameError(template, 'a'.repeat(26))).toMatch(/100 characters or fewer/);
    // A one-digit day leaves one more character for a single raid.
    expect(raidNameError(template, 'a'.repeat(26), new Date('2026-11-04T04:00:00.000Z'))).toBeNull();
  });

  it('cuts a series addition to fit when its template was renamed longer', () => {
    expect(fitTitleAddition('Onyxia', 'Key Run')).toBe('Key Run');
    expect(fitTitleAddition('Onyxia', null)).toBeNull();
    const template = 'T'.repeat(60);
    const fitted = fitTitleAddition(template, 'Key Run plus a lot more words here ok')!;
    expect(fitted).toBe('Key Run plus a lot more w');
    expect(raidNameError(template, fitted)).toBeNull();
    // A cut that ends on a space is trimmed; no room at all means no addition.
    expect(fitTitleAddition(template, 'Key Run plus a lot more  wx')).toBe('Key Run plus a lot more');
    expect(fitTitleAddition('T'.repeat(86), 'Key Run')).toBeNull();
  });
});
