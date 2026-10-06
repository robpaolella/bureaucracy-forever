import { describe, expect, it } from 'vitest';
import {
  applyPaint,
  applyPaintRun,
  blockAt,
  blockLabel,
  blockRange,
  blockRemoveLabel,
  cellLabel,
  dayBlocks,
  DAYS,
  removeBlock,
  resizeBlock,
  SLOTS,
  weekFromBlocks,
  type Block,
  countStates,
  fmtSlot,
  isValidTimeZone,
  isWeek,
  normalizeWeek,
  offsetDescription,
  parseKey,
  relativeTime,
  guildOffsetSlots,
  slotStartsAt,
  weekDays,
  weekStart,
  type Week,
} from './availability';
import { viewerTime } from './time';

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

describe('blocks', () => {
  /** Tue 7:00–11:00 PM available, then 11:00 PM – midnight if needed. */
  const tue: Week = { ...applyPaintRun({}, 1, 38, 45, 'available'), ...applyPaintRun({}, 1, 46, 47, 'if-needed') };
  const avail: Block = { day: 1, start: 38, end: 46, state: 'available' };
  const late: Block = { day: 1, start: 46, end: 48, state: 'if-needed' };

  describe('grouping', () => {
    it('merges back-to-back slots of one state and keeps states apart', () => {
      expect(dayBlocks(tue, 1)).toEqual([avail, late]);
      expect(dayBlocks(tue, 0)).toEqual([]);
    });

    it('splits a run at a gap', () => {
      const week = applyPaint(applyPaintRun({}, 2, 10, 15, 'available'), '2:12', 'erase');
      expect(dayBlocks(week, 2)).toEqual([
        { day: 2, start: 10, end: 12, state: 'available' },
        { day: 2, start: 13, end: 16, state: 'available' },
      ]);
    });

    it('makes a half-hour block, one running to midnight and an all-day block', () => {
      expect(dayBlocks({ '3:37': 'if-needed' }, 3)).toEqual([{ day: 3, start: 37, end: 38, state: 'if-needed' }]);
      expect(dayBlocks({ '3:47': 'available' }, 3)).toEqual([{ day: 3, start: 47, end: 48, state: 'available' }]);
      expect(dayBlocks(applyPaintRun({}, 0, 0, 47, 'available'), 0)).toEqual([{ day: 0, start: 0, end: SLOTS, state: 'available' }]);
    });

    it('finds the block under a slot', () => {
      expect(blockAt(tue, 1, 38)).toEqual(avail);
      expect(blockAt(tue, 1, 45)).toEqual(avail);
      expect(blockAt(tue, 1, 46)).toEqual(late);
      expect(blockAt(tue, 1, 37)).toBeNull();
    });

    it('rebuilds an existing week identically, down to its saved JSON', () => {
      const saved: Week = { '6:40': 'available', '0:0': 'if-needed', '1:41': 'available', '1:42': 'if-needed', '5:47': 'available' };
      const blocks = Array.from({ length: DAYS }, (_, d) => dayBlocks(saved, d)).flat();
      const rebuilt = weekFromBlocks(blocks);
      expect(rebuilt).toEqual(saved);
      expect(isWeek(rebuilt)).toBe(true);
      // Reading blocks never writes, and an unmoved edge returns the same object, so an
      // untouched week saves byte-identical JSON.
      const json = JSON.stringify(saved);
      for (let d = 0; d < DAYS; d++) dayBlocks(saved, d);
      expect(JSON.stringify(saved)).toBe(json);
      const block = dayBlocks(saved, 6)[0];
      expect(JSON.stringify(resizeBlock(saved, block, 'end', block.end))).toBe(json);
    });
  });

  describe('resizing', () => {
    it('grows and shrinks either edge in half-hour steps', () => {
      expect(dayBlocks(resizeBlock(tue, avail, 'start', 36), 1)[0]).toEqual({ ...avail, start: 36 });
      expect(dayBlocks(resizeBlock(tue, avail, 'start', 40), 1)[0]).toEqual({ ...avail, start: 40 });
      expect(dayBlocks(resizeBlock(tue, avail, 'end', 44), 1)).toEqual([{ ...avail, end: 44 }, late]);
      const grown = resizeBlock(tue, late, 'start', 47);
      expect(dayBlocks(grown, 1)).toEqual([{ ...avail, end: 46 }, { ...late, start: 47 }]);
      expect(grown['1:46']).toBeUndefined();
    });

    it('stops one half-hour short of the other edge', () => {
      expect(dayBlocks(resizeBlock(tue, avail, 'start', 46), 1)[0]).toEqual({ ...avail, start: 45 });
      expect(dayBlocks(resizeBlock(tue, avail, 'end', 30), 1)[0]).toEqual({ ...avail, end: 39 });
      const one: Block = { day: 4, start: 20, end: 21, state: 'available' };
      const week = { '4:20': 'available' } as Week;
      expect(resizeBlock(week, one, 'end', 20)).toBe(week);
      expect(resizeBlock(week, one, 'start', 21)).toBe(week);
      // An edge released where it started changes nothing.
      expect(resizeBlock(tue, avail, 'start', 38)).toBe(tue);
      expect(resizeBlock(tue, avail, 'end', 46)).toBe(tue);
    });

    it('clamps to the day', () => {
      expect(dayBlocks(resizeBlock(tue, avail, 'start', -5), 1)[0]).toEqual({ ...avail, start: 0 });
      const week = { '2:40': 'available' } as Week;
      const block = dayBlocks(week, 2)[0];
      expect(dayBlocks(resizeBlock(week, block, 'end', 60), 2)).toEqual([{ ...block, end: SLOTS }]);
      expect(Object.keys(resizeBlock(week, block, 'end', 60)).every((k) => k.startsWith('2:'))).toBe(true);
    });

    it('merges into a same-state block it grows over', () => {
      const week: Week = { ...applyPaintRun({}, 2, 36, 39, 'available'), ...applyPaintRun({}, 2, 42, 44, 'available') };
      const [first] = dayBlocks(week, 2);
      expect(dayBlocks(resizeBlock(week, first, 'end', 43), 2)).toEqual([{ day: 2, start: 36, end: 45, state: 'available' }]);
    });

    it('replaces the other state it grows over, shrinking or removing that block', () => {
      // The approved dragging state: Tue 7:00–11:00 PM pulled down to 11:30 PM.
      expect(dayBlocks(resizeBlock(tue, avail, 'end', 47), 1)).toEqual([{ ...avail, end: 47 }, { ...late, start: 47 }]);
      expect(dayBlocks(resizeBlock(tue, avail, 'end', 48), 1)).toEqual([{ ...avail, end: 48 }]);
      expect(dayBlocks(resizeBlock(tue, late, 'start', 30), 1)).toEqual([{ ...late, start: 30 }]);
    });

    it('returns a valid week and leaves the input untouched', () => {
      const before = JSON.stringify(tue);
      for (const to of [-3, 0, 20, 38, 45, 46, 47, 48, 70]) {
        expect(isWeek(resizeBlock(tue, avail, 'start', to))).toBe(true);
        expect(isWeek(resizeBlock(tue, avail, 'end', to))).toBe(true);
      }
      expect(JSON.stringify(tue)).toBe(before);
    });
  });

  it('removes exactly a block’s slots', () => {
    const next = removeBlock(tue, avail);
    expect(next).toEqual(applyPaintRun({}, 1, 46, 47, 'if-needed'));
    expect(isWeek(next)).toBe(true);
    expect(dayBlocks(removeBlock(next, late), 1)).toEqual([]);
  });

  describe('labels', () => {
    const allDay: Block = { day: 0, start: 0, end: SLOTS, state: 'available' };

    it('prints the range as the design does', () => {
      expect(blockRange(avail)).toBe('7:00 – 11:00 PM');
      expect(blockRange(late)).toBe('11:00 PM – 12:00 AM');
      expect(blockRange(allDay)).toBe('All day');
      expect(blockRange({ day: 3, start: 37, end: 38, state: 'if-needed' })).toBe('6:30 – 7:00 PM');
      expect(blockRange({ day: 4, start: 22, end: 26, state: 'available' })).toBe('11:00 AM – 1:00 PM');
      expect(blockRange({ day: 4, start: 0, end: 2, state: 'available' })).toBe('12:00 – 1:00 AM');
      // Ends at midnight but starts in the morning: both halves are AM, yet it is not a short range.
      expect(blockRange({ day: 4, start: 2, end: SLOTS, state: 'available' })).toBe('1:00 AM – 12:00 AM');
    });

    it('names a block for screen readers and its remove button', () => {
      expect(blockLabel(avail)).toBe('Available, Tuesday 7:00 PM to 11:00 PM');
      expect(blockLabel(late)).toBe('If needed, Tuesday 11:00 PM to 12:00 AM');
      expect(blockLabel(allDay)).toBe('Available, Monday all day');
      expect(blockRemoveLabel(avail)).toBe('Remove available 7:00 – 11:00 PM');
      expect(blockRemoveLabel(late)).toBe('Remove if needed 11:00 PM – 12:00 AM');
      expect(blockRemoveLabel(allDay)).toBe('Remove available all day');
    });
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

  it('describes the guild-time offset', () => {
    expect(offsetDescription(4)).toBe('2 hours ahead');
    expect(offsetDescription(-2)).toBe('1 hour behind');
    expect(offsetDescription(0)).toBe('same time');
    expect(offsetDescription(11)).toBe('5½ hours ahead');
    expect(offsetDescription(1)).toBe('½ hour ahead');
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

  it('measures how far the guild clock is ahead, in half hours', () => {
    const summer = new Date('2026-09-29T12:00:00Z');
    // Guild time is America/Los_Angeles (PDT, UTC−7, in September).
    expect(guildOffsetSlots(summer, 'America/Los_Angeles')).toBe(0);
    expect(guildOffsetSlots(summer, 'America/Chicago')).toBe(-4);
    expect(guildOffsetSlots(summer, 'Europe/London')).toBe(-16);
    expect(guildOffsetSlots(summer, 'Asia/Kolkata')).toBe(-25);
    // Kathmandu is UTC+5:45: guild time is 12h45 behind = -25.5 slots; Math.round takes .5 up, so -25.
    expect(guildOffsetSlots(summer, 'Asia/Kathmandu')).toBe(-25);
  });

  it('keeps a week whole across the US fall-back and the UK/US gap', () => {
    // Week of Mon 26 Oct – Sun 1 Nov 2026 in Chicago: clocks fall back on the Sunday.
    const days = weekDays(new Date('2026-10-28T18:00:00Z'), 'America/Chicago');
    expect(days.map((d) => d.date)).toEqual(['26 Oct', '27 Oct', '28 Oct', '29 Oct', '30 Oct', '31 Oct', '1 Nov']);
    expect(weekStart(new Date('2026-10-28T18:00:00Z'), 'America/Chicago').toISOString()).toBe('2026-10-26T05:00:00.000Z');
    // The week after starts under CST: Monday 00:00 is 06:00Z, not 05:00Z.
    expect(weekStart(new Date('2026-11-04T18:00:00Z'), 'America/Chicago').toISOString()).toBe('2026-11-02T06:00:00.000Z');
    // Spring forward: the week containing 8 Mar 2026 still has seven correctly dated days.
    expect(weekDays(new Date('2026-03-04T18:00:00Z'), 'America/Chicago').map((d) => d.date)).toEqual(['2 Mar', '3 Mar', '4 Mar', '5 Mar', '6 Mar', '7 Mar', '8 Mar']);
    // The guild offset for a London member changes between the two DST changes:
    // London falls back on 25 Oct 2026, Los Angeles on 1 Nov.
    expect(guildOffsetSlots(weekStart(new Date('2026-10-21T12:00:00Z'), 'Europe/London'), 'Europe/London')).toBe(-16);
    expect(guildOffsetSlots(weekStart(new Date('2026-10-28T12:00:00Z'), 'Europe/London'), 'Europe/London')).toBe(-14);
    // From 2 Nov both are on standard time and the gap is eight hours again.
    expect(guildOffsetSlots(weekStart(new Date('2026-11-04T12:00:00Z'), 'Europe/London'), 'Europe/London')).toBe(-16);
  });

  it('validates timezones', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
  });
});

describe('slot instants', () => {
  const LON = 'Europe/London';
  // Wed 30 Sep 2026: the week of Mon 28 Sep, London on BST (UTC+1), guild time on PDT (UTC−7).
  const now = new Date('2026-09-30T12:00:00Z');
  const gutter = (slot: number) => viewerTime(new Date(slotStartsAt(now, LON, 0, slot)), 0, LON, 'en-US', { weekday: 'never', zoneName: false });

  it("starts each slot on the zone's own clock", () => {
    expect(slotStartsAt(now, LON, 0, 0)).toBe('2026-09-27T23:00:00.000Z');
    expect(slotStartsAt(now, LON, 0, 40)).toBe('2026-09-28T19:00:00.000Z');
    expect(slotStartsAt(now, LON, 6, 47)).toBe('2026-10-04T22:30:00.000Z');
  });

  it('labels every gutter row as fmtSlot does, with the guild time the old gutter showed', () => {
    const offset = guildOffsetSlots(weekStart(now, LON), LON);
    for (let slot = 0; slot < 48; slot += 2) {
      const t = gutter(slot);
      expect(t.text).toBe(fmtSlot(slot));
      expect(t.guild).toBe(`${fmtSlot(slot + offset)} guild time (PDT)`);
    }
  });

  it('gives guild time for a row past midnight, no weekday', () => {
    // 1:00 AM Monday in London is 5:00 PM Sunday in guild time.
    expect(gutter(2)).toEqual({ text: '1:00 AM', guild: '5:00 PM guild time (PDT)', label: '1:00 AM GMT+1, 5:00 PM guild time (PDT)' });
  });

  it('keeps the label on the wall clock in a week with a DST change', () => {
    // Week of Mon 19 Oct 2026: London falls back on Sunday 25 Oct, Los Angeles a week later.
    const dst = new Date('2026-10-21T12:00:00Z');
    // Sunday 10:00 AM GMT is 10:00Z, so 3:00 AM PDT: a real hour later than the week-start
    // offset (−16 slots, 2:00 AM) says, and the popup tells the truth for that day.
    const sunday = new Date(slotStartsAt(dst, LON, 6, 20));
    expect(sunday.toISOString()).toBe('2026-10-25T10:00:00.000Z');
    expect(viewerTime(sunday, 0, LON, 'en-US', { weekday: 'never', zoneName: false })).toMatchObject({ text: '10:00 AM', guild: '3:00 AM guild time (PDT)' });
  });
});
