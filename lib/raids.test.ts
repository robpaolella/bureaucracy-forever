import { describe, expect, it } from 'vitest';
import { applyResponse, countAccepted, countTone, DEFAULT_REQUIREMENTS, emptyRaidInput, groupSignups, mergeLocal, parseRaidInput, raidToInput, isRaidResponse, isTonight, isUpcoming, linkOpensReserves, parseRequirements, promptsReserves, raidDate, raidWeekday, reservesUrl, responseToast, sourceSplit, totalCounts, viewerReserves, ZERO_COUNTS, type RaidCard, type SignupRow } from './raids';

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
    expect(raidDate(raid.startsAt)).toBe('Wednesday, Nov 4');
  });
});

describe('promptsReserves', () => {
  const me = (hr: number | null, sr: number | null) => ({ self: true, current: { hr, sr } });
  const open = { locked: false, cancelled: false, targets: [me(null, null)] };

  it('opens after Accept or Tentative when the viewer can reserve and has no reserves', () => {
    expect(promptsReserves('accept', open)).toBe(true);
    expect(promptsReserves('tentative', open)).toBe(true);
  });

  it.each([
    ['Absent', 'absent', open],
    ['a withdrawn answer', null, open],
    ['loot off or no loot table', 'accept', null],
    ['locked reserves', 'accept', { ...open, locked: true }],
    ['a cancelled raid', 'accept', { ...open, cancelled: true }],
    ['no character to reserve with', 'accept', { ...open, targets: [] }],
    ['a saved hard reserve (Accept and Tentative switching)', 'tentative', { ...open, targets: [me(100, null)] }],
    ['a saved soft reserve', 'accept', { ...open, targets: [me(null, 200)] }],
  ] as const)('stays closed for %s', (_label, answer, window) => {
    expect(promptsReserves(answer, window)).toBe(false);
  });

  it('looks only at the viewer, not members an officer could reserve for', () => {
    expect(promptsReserves('accept', { ...open, targets: [{ self: false, current: { hr: null, sr: null } }] })).toBe(false);
    expect(promptsReserves('accept', { ...open, targets: [{ self: false, current: { hr: 1, sr: 2 } }, me(null, null)] })).toBe(true);
  });
});

describe('linkOpensReserves', () => {
  const me = (hr: number | null, sr: number | null) => ({ self: true, current: { hr, sr } });
  const other = { self: false, current: { hr: null, sr: null } };
  const open = { locked: false, cancelled: false, targets: [me(null, null)] };

  it("opens the viewer's own window from the link, with or without saved reserves", () => {
    expect(linkOpensReserves('1', open)).toBe(true);
    expect(linkOpensReserves('1', { ...open, targets: [me(100, 200)] })).toBe(true);
  });

  it.each([
    ['no link', undefined, open],
    ['another value', '0', open],
    ['a repeated query', ['1', '1'], open],
    ['loot off, no loot table or a social member (no window)', '1', null],
    ['locked reserves', '1', { ...open, locked: true }],
    ['a cancelled raid', '1', { ...open, cancelled: true }],
    ['Absent, unanswered or no character (no target of their own)', '1', { ...open, targets: [] }],
    ["an officer who isn't eligible, even with members to reserve for", '1', { ...open, targets: [other] }],
  ] as const)('shows the page without it for %s', (_label, param, window) => {
    expect(linkOpensReserves(param, window)).toBe(false);
  });

  it("opens for an officer who is eligible (on their own reserves, which Reserves picks first)", () => {
    expect(linkOpensReserves('1', { ...open, targets: [other, me(null, null)] })).toBe(true);
  });
});

describe('viewerReserves', () => {
  const now = new Date('2026-11-04T12:00:00Z');
  const raid = { id: 'r1', startsAt: new Date('2026-11-05T04:00:00Z'), hasLootTable: true };

  it('gives the link and the lock, table and completeness the bot needs', () => {
    expect(viewerReserves(raid, ['HR', 'SR'], now, true)).toEqual({
      lootTable: true,
      reservesLocked: false,
      reservesComplete: true,
      reservesUrl: 'https://www.bureauguild.com/members/calendar/r1?reserves=1',
    });
    expect(reservesUrl('r1')).toBe('https://www.bureauguild.com/members/calendar/r1?reserves=1');
  });

  it('has no loot table while loot is off or the tier has none', () => {
    expect(viewerReserves(raid, [], now, false).lootTable).toBe(false);
    expect(viewerReserves({ ...raid, hasLootTable: false }, [], now, true).lootTable).toBe(false);
  });

  it('locks at the reserve lock, two hours before the start, not the sign-up lock', () => {
    expect(viewerReserves(raid, [], new Date('2026-11-05T01:59:59Z'), true).reservesLocked).toBe(false);
    expect(viewerReserves(raid, [], new Date('2026-11-05T02:00:00Z'), true).reservesLocked).toBe(true);
  });

  it.each([
    ['none', [], false],
    ['a hard reserve only', ['HR'], false],
    ['a soft reserve only', ['SR'], false],
    ['both', ['SR', 'HR'], true],
  ] as const)('is complete only with both reserves: %s', (_label, kinds, complete) => {
    expect(viewerReserves(raid, kinds, now, true).reservesComplete).toBe(complete);
  });
});

describe('responseToast', () => {
  const raid = { name: 'Blackwing Lair', startsAt: '2026-11-05T04:00:00.000Z' };

  it("writes the docs copy with the viewer's time and zone", () => {
    expect(responseToast(raid, 'accept', 'America/Chicago', 'en-US')).toEqual({ title: "You're in for Wednesday — Blackwing Lair", detail: '10:00 PM CST' });
    expect(responseToast(raid, 'accept', 'Europe/London', 'en-GB').detail).toBe('Thu 4:00 AM GMT');
    expect(responseToast(raid, 'tentative', 'America/Los_Angeles', 'en-US')).toMatchObject({ title: 'Marked tentative for Wednesday — Blackwing Lair', detail: '8:00 PM guild time' });
    expect(responseToast(raid, 'absent', null, 'en-US').detail).toBe('8:00 PM guild time');
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
