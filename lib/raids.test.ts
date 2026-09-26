import { describe, expect, it } from 'vitest';
import { applyResponse, countAccepted, countTone, DEFAULT_REQUIREMENTS, emptyRaidInput, groupSignups, mergeLocal, parseRaidInput, raidToInput, isRaidResponse, isTonight, isUpcoming, parseRequirements, raidWeekday, responseToast, sourceSplit, totalCounts, ZERO_COUNTS, type RaidCard, type SignupRow } from './raids';

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

describe('raid detail', () => {
  const row = (over: Partial<SignupRow>): SignupRow => ({
    userId: 'u',
    name: 'Redtape',
    wowClass: 'priest',
    spec: 'Holy',
    role: 'healer',
    response: 'accept',
    source: 'web',
    reason: null,
    setBy: null,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  });

  it('groups sign-ups by response, newest first', () => {
    const sections = groupSignups([
      row({ userId: 'a', updatedAt: '2026-10-01T00:00:00.000Z' }),
      row({ userId: 'b', response: 'absent', reason: 'work' }),
      row({ userId: 'c', updatedAt: '2026-10-02T00:00:00.000Z' }),
      row({ userId: 'd', response: 'tentative' }),
    ]);
    expect(sections.accept.map((r) => r.userId)).toEqual(['c', 'a']);
    expect(sections.tentative.map((r) => r.userId)).toEqual(['d']);
    expect(sections.absent[0].reason).toBe('work');
  });

  it('splits answers by surface and totals the role counts', () => {
    expect(sourceSplit([row({}), row({ source: 'discord' }), row({ source: 'discord', response: 'absent' })])).toEqual({ web: 1, discord: 2 });
    expect(totalCounts({ tank: 2, healer: 8, melee: 11, ranged: 14 })).toBe(35);
  });
});

describe('schedule form input', () => {
  const good = { name: 'Blackwing Lair', date: '2026-11-04', time: '19:00', durationMin: 180, requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 }, notes: '' };

  it('derives the instant in guild time', () => {
    const r = parseRaidInput(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // 4 Nov 2026 is after the US fall-back: 19:00 PST is 03:00Z next day.
      expect(r.startsAt.toISOString()).toBe('2026-11-05T03:00:00.000Z');
      expect(r.value.name).toBe('Blackwing Lair');
    }
    const summer = parseRaidInput({ ...good, date: '2026-10-07' });
    if (summer.ok) expect(summer.startsAt.toISOString()).toBe('2026-10-08T02:00:00.000Z');
  });

  it('names the field that failed', () => {
    expect(parseRaidInput({ ...good, name: ' ' })).toMatchObject({ ok: false, error: /name/ });
    expect(parseRaidInput({ ...good, date: '2026-13-01' })).toMatchObject({ ok: false, error: /not real/ });
    expect(parseRaidInput({ ...good, date: '2026-02-30' })).toMatchObject({ ok: false, error: /not real/ });
    // 14 Mar 2027 the clocks jump 02:00 → 03:00 in Los Angeles: 02:30 never happens.
    expect(parseRaidInput({ ...good, date: '2027-03-14', time: '02:30' })).toMatchObject({ ok: false, error: /not real/ });
    expect(parseRaidInput({ ...good, date: '2027-03-14', time: '03:30' })).toMatchObject({ ok: true });
    expect(parseRaidInput({ ...good, time: '7pm' })).toMatchObject({ ok: false, error: /start time/ });
    expect(parseRaidInput({ ...good, durationMin: 100 })).toMatchObject({ ok: false, error: /length/ });
    expect(parseRaidInput({ ...good, requirements: { tank: 2, healer: 8, melee: 9, ranged: 41 } })).toMatchObject({ ok: false, error: /0 to 40/ });
    expect(parseRaidInput({ ...good, requirements: { tank: 0, healer: 0, melee: 0, ranged: 0 } })).toMatchObject({ ok: false, error: /at least one/ });
    expect(parseRaidInput({ ...good, notes: 'x'.repeat(501) })).toMatchObject({ ok: false, error: /notes/ });
  });

  it('round-trips a stored raid through the form values', () => {
    const input = raidToInput({ name: 'MC', startsAt: '2026-10-08T02:00:00.000Z', durationMin: 180, requirements: good.requirements, notes: null });
    expect(input).toMatchObject({ date: '2026-10-07', time: '19:00', notes: '' });
  });

  it('prefills the next matching guild-time weekday from a heatmap window', () => {
    // Saturday 26 Sep 2026, 10:00 PDT.
    const now = new Date('2026-09-26T17:00:00.000Z');
    expect(emptyRaidInput({ weekday: 3, time: '20:00', length: 240 }, now)).toMatchObject({ date: '2026-09-30', time: '20:00', durationMin: 240 });
    expect(emptyRaidInput({}, now)).toMatchObject({ date: '2026-09-26', time: '19:00', durationMin: 180, requirements: DEFAULT_REQUIREMENTS });
  });
});

describe('mergeLocal', () => {
  const card = (over: Partial<RaidCard>): RaidCard => ({
    id: 'x',
    name: 'MC',
    startsAt: '2026-10-08T02:00:00.000Z',
    durationMin: 180,
    notes: null,
    cancelled: false,
    requirements: { tank: 2, healer: 8, melee: 9, ranged: 11 },
    counts: { tank: 2, healer: 6, melee: 9, ranged: 11 },
    mine: null,
    ...over,
  });

  it('keeps a pending local answer over a server card that has not seen it', () => {
    const local = new Map([['x', { mine: 'accept' as const, counts: { tank: 2, healer: 7, melee: 9, ranged: 11 } }]]);
    expect(mergeLocal([card({})], local)[0]).toMatchObject({ mine: 'accept', counts: { healer: 7 } });
  });

  it('drops the local answer once the server card carries it, so fresher counts win', () => {
    const local = new Map([['x', { mine: 'accept' as const, counts: { tank: 2, healer: 7, melee: 9, ranged: 11 } }]]);
    const fresh = card({ mine: 'accept', counts: { tank: 2, healer: 8, melee: 9, ranged: 11 } });
    expect(mergeLocal([fresh], local)[0]).toBe(fresh);
    expect(mergeLocal([card({ id: 'y' })], local)[0].mine).toBeNull();
  });
});
