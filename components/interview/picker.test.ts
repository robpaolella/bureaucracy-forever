import { describe, expect, it } from 'vitest';
import { countBlocks } from '@/lib/interview-minimum';
import { pickerStarts } from '@/lib/interview-slots';
import { hourButtons, hourRuns, pickerDays, pickerSummary, zoneLabel } from './picker';

const NY = 'America/New_York';
const at = (iso: string) => Date.parse(iso);
// The approved design's request: Thu 15 Oct 2026, 3:10 PM guild time (PDT).
const OFFERED = pickerStarts(new Date('2026-10-15T22:10:00Z'), new Date('2026-10-15T22:15:00Z')).map((d) => d.getTime());
const halfHours = (from: string, count: number) => Array.from({ length: count }, (_, i) => at(from) + i * 30 * 60_000);

describe('pickerDays', () => {
  it('splits the starts by the viewer’s calendar day', () => {
    const days = pickerDays(OFFERED, NY);
    // Thu 15 Oct opens with the window's first start (5:30 PM guild = 8:30 PM Eastern).
    expect(days[0]).toMatchObject({ key: 20261015, year: 2026, month: 10, day: 15 });
    expect(new Date(days[0].starts[0]).toISOString()).toBe('2026-10-16T00:30:00.000Z');
    expect(days).toHaveLength(8);
  });

  it('keeps an evening that crosses the viewer’s midnight as two viewer days', () => {
    const days = pickerDays(halfHours('2026-10-20T02:00:00Z', 8), NY);
    expect(days.map((d) => d.key)).toEqual([20261019, 20261020]);
  });
});

describe('hourButtons', () => {
  it('holds both half-hour starts of an hour, and one at a window edge', () => {
    const [first, second] = hourButtons(pickerDays(OFFERED, NY)[0].starts, NY);
    expect(first.map((t) => new Date(t).toISOString())).toEqual(['2026-10-16T00:30:00.000Z']); // 8:30 PM
    expect(second.map((t) => new Date(t).toISOString())).toEqual(['2026-10-16T01:00:00.000Z', '2026-10-16T01:30:00.000Z']); // 9:00 PM
  });

  it('keeps the two hours that share a wall-clock hour when the clocks fall back as two buttons', () => {
    // 1:00 AM EDT and 1:00 AM EST, an hour apart on Sun 1 Nov 2026.
    const buttons = hourButtons(halfHours('2026-11-01T05:00:00Z', 4), NY);
    expect(buttons).toHaveLength(2);
  });

  it('reads whole hours on the viewer’s clock, so on a half-hour offset one button spans two guild hours', () => {
    // 8:00–9:00 AM in India is 2:30–3:30 AM UTC, which is two guild hours.
    const starts = halfHours('2026-10-16T02:30:00Z', 2);
    const buttons = hourButtons(starts, 'Asia/Kolkata');
    expect(buttons).toEqual([starts]);
    // The footer follows countBlocks: one button, two guild blocks.
    expect(countBlocks(starts.map((t) => new Date(t))).blocks).toBe(2);
  });
});

describe('hourRuns', () => {
  it('breaks the run where the day has a gap, and only there', () => {
    // 11:00 PM and 12:00 AM are consecutive, 1:00 AM to 12:00 PM is a gap (a viewer's midnight in the window).
    const hours = [halfHours('2026-10-16T03:00:00Z', 2), halfHours('2026-10-16T04:00:00Z', 2), halfHours('2026-10-16T16:00:00Z', 2)];
    expect(hourRuns(hours).map((run) => run.length)).toEqual([2, 1]);
    expect(hourRuns(hours.slice(0, 2))).toHaveLength(1);
  });
});

describe('pickerSummary', () => {
  // `count` whole guild hours from `from` o'clock (PDT) on October `guildDay`, as half-hour starts.
  const hours = (guildDay: number, from: number, count: number) => halfHours(new Date(Date.UTC(2026, 9, guildDay, from + 7)).toISOString(), count * 2);

  it('says what is missing, in the design’s words', () => {
    expect(pickerSummary([])).toEqual({ text: 'Nothing picked yet · pick at least 5 hours on 2 or more days', tone: 'closed', canSend: false });
    expect(pickerSummary(hours(17, 10, 4))).toMatchObject({ text: '4 of 5 hours picked · add 1 more, on another day', canSend: false });
    expect(pickerSummary([...hours(17, 10, 3), ...hours(18, 10, 1)])).toMatchObject({ text: '4 of 5 hours picked · add 1 more', canSend: false });
    expect(pickerSummary(hours(17, 10, 5))).toMatchObject({ text: '5 hours picked on 1 day · add an hour on another day', canSend: false });
  });

  it('opens Send at 5 hours on 2 days', () => {
    expect(pickerSummary([...hours(17, 10, 4), ...hours(18, 10, 1)])).toEqual({ text: '5 hours picked on 2 days · not sent yet', tone: 'warn', canSend: true });
  });

  it('counts a viewer-midnight evening as one guild day', () => {
    // 6:00–11:00 PM guild time on Mon 19 Oct crosses midnight in New York, but is one guild day.
    const evening = hours(19, 18, 5);
    expect(pickerDays(evening, NY)).toHaveLength(2);
    expect(pickerSummary(evening).text).toBe('5 hours picked on 1 day · add an hour on another day');
  });

  it('counts the block rule from lib/interview-minimum, one hour at the window edge included', () => {
    const edge = [at('2026-10-16T00:30:00Z'), ...hours(17, 10, 4)];
    expect(pickerSummary(edge)).toMatchObject({ canSend: true });
  });
});

describe('zoneLabel', () => {
  it('names the zone, its short name and offset', () => {
    expect(zoneLabel(NY, new Date('2026-10-16T00:30:00Z'))).toBe('Eastern time · EDT (UTC−4)');
  });
});
