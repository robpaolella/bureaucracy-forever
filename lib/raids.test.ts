import { describe, expect, it } from 'vitest';
import { applyResponse, countAccepted, countTone, isRaidResponse, isTonight, isUpcoming, parseRequirements, raidWeekday, responseToast, ZERO_COUNTS } from './raids';

describe('requirements and counts', () => {
  it('parses a JSON requirements column defensively', () => {
    expect(parseRequirements({ tank: 2, healer: 8, melee: 11, ranged: 14 })).toEqual({ tank: 2, healer: 8, melee: 11, ranged: 14 });
    expect(parseRequirements({ tank: '2', healer: -1, melee: 2.7 })).toEqual({ tank: 0, healer: 0, melee: 2, ranged: 0 });
    expect(parseRequirements(null)).toEqual(ZERO_COUNTS);
  });

  it('counts only accepted sign-ups with a known role', () => {
    expect(
      countAccepted([
        { response: 'accept', role: 'tank' },
        { response: 'accept', role: 'tank' },
        { response: 'tentative', role: 'healer' },
        { response: 'accept', role: null },
        { response: 'absent', role: 'melee' },
      ]),
    ).toEqual({ tank: 2, healer: 0, melee: 0, ranged: 0 });
  });

  it('moves the viewer’s own count when their answer changes', () => {
    const c = { tank: 2, healer: 8, melee: 11, ranged: 14 };
    expect(applyResponse(c, 'healer', null, 'accept')).toEqual({ ...c, healer: 9 });
    expect(applyResponse(c, 'healer', 'accept', 'absent')).toEqual({ ...c, healer: 7 });
    expect(applyResponse(c, 'healer', 'tentative', 'absent')).toEqual(c);
    expect(applyResponse(c, null, null, 'accept')).toEqual(c);
    expect(applyResponse({ ...c, healer: 0 }, 'healer', 'accept', null)).toEqual({ ...c, healer: 0 });
  });

  it('tones a count against its requirement', () => {
    expect(countTone(2, 2)).toBe('ok');
    expect(countTone(3, 2)).toBe('ok');
    expect(countTone(1, 2)).toBe('warn');
    expect(countTone(0, 2)).toBe('stop');
    expect(countTone(0, 0)).toBe('ok');
  });

  it('validates responses', () => {
    expect(isRaidResponse('accept')).toBe(true);
    expect(isRaidResponse('maybe')).toBe(false);
    expect(isRaidResponse(null)).toBe(false);
  });
});

describe('timing', () => {
  const raid = { startsAt: '2026-11-05T04:00:00.000Z', durationMin: 180 }; // Wed 4 Nov 20:00 PST

  it('keeps a raid upcoming until it ends', () => {
    expect(isUpcoming(raid, new Date('2026-11-04T12:00:00Z'))).toBe(true);
    expect(isUpcoming(raid, new Date('2026-11-05T06:00:00Z'))).toBe(true); // in progress
    expect(isUpcoming(raid, new Date('2026-11-05T07:00:01Z'))).toBe(false);
  });

  it('knows tonight in the viewer’s zone, not the server’s', () => {
    // 04:00Z on 5 Nov is the evening of 4 Nov in Los Angeles but already 5 Nov in Berlin.
    expect(isTonight(raid.startsAt, new Date('2026-11-04T18:00:00Z'), 'America/Los_Angeles')).toBe(true);
    expect(isTonight(raid.startsAt, new Date('2026-11-04T18:00:00Z'), 'Europe/Berlin')).toBe(false);
    expect(isTonight(raid.startsAt, new Date('2026-11-05T10:00:00Z'), 'Europe/Berlin')).toBe(true);
  });

  it('names the weekday in guild time', () => {
    expect(raidWeekday(raid.startsAt)).toBe('Wednesday');
  });
});

describe('responseToast', () => {
  const raid = { name: 'Blackwing Lair', startsAt: '2026-11-05T04:00:00.000Z' };

  it('writes the docs copy with the dual time', () => {
    expect(responseToast(raid, 'accept', 'America/Chicago')).toEqual({ title: "You're in for Wednesday — Blackwing Lair", detail: '8:00 PM guild · 10:00 PM your time' });
    expect(responseToast(raid, 'tentative', 'America/Los_Angeles').title).toBe('Marked tentative for Wednesday — Blackwing Lair');
    expect(responseToast(raid, 'absent', null).detail).toBe('8:00 PM guild');
    expect(responseToast(raid, null, null).title).toBe('Answer withdrawn for Wednesday — Blackwing Lair');
  });
});
