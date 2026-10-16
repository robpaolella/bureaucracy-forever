import { describe, expect, it } from 'vitest';
import { countBlocks, minimumShortfall } from './interview-minimum';

const at = (iso: string) => new Date(iso);
// Guild time is America/Los_Angeles (UTC-7 in October): 17:00Z is 10:00 AM.
const hours = (day: string, startUtcHour: number, n: number) => Array.from({ length: n }, (_, i) => at(`${day}T${String(startUtcHour + i).padStart(2, '0')}:00:00Z`));

describe('countBlocks', () => {
  it('counts the two half-hour starts of one hour as one block', () => {
    expect(countBlocks([at('2026-10-17T17:00:00Z'), at('2026-10-17T17:30:00Z')])).toEqual({ blocks: 1, days: 1 });
  });

  it('counts a block that holds only one start', () => {
    expect(countBlocks([at('2026-10-17T17:30:00Z')])).toEqual({ blocks: 1, days: 1 });
  });

  it('counts an evening that crosses the viewer midnight as one guild day', () => {
    // 6 PM to 10 PM guild time is 01:00Z to 05:00Z the next UTC day.
    expect(countBlocks(hours('2026-10-18', 1, 5))).toEqual({ blocks: 5, days: 1 });
  });

  it('splits days at guild midnight', () => {
    // 11 PM and 12 AM in Los Angeles are two days; both fall on one UTC day.
    expect(countBlocks([at('2026-10-18T06:00:00Z'), at('2026-10-18T07:00:00Z')])).toEqual({ blocks: 2, days: 2 });
  });

  it('counts days in the zone it is given', () => {
    const picks = [at('2026-10-18T06:00:00Z'), at('2026-10-18T07:00:00Z')];
    expect(countBlocks(picks, 'UTC')).toEqual({ blocks: 2, days: 1 });
    expect(countBlocks(picks)).toEqual({ blocks: 2, days: 2 });
  });

  it('counts nothing for no picks', () => {
    expect(countBlocks([])).toEqual({ blocks: 0, days: 0 });
  });
});

describe('minimumShortfall', () => {
  it('accepts 5 blocks on 2 days', () => {
    expect(minimumShortfall([...hours('2026-10-17', 17, 3), ...hours('2026-10-18', 17, 2)])).toBeNull();
  });
  it('accepts more than the minimum', () => {
    expect(minimumShortfall([...hours('2026-10-17', 17, 6), ...hours('2026-10-18', 17, 6)])).toBeNull();
  });
  it('refuses 4 blocks on 2 days, naming the missing block', () => {
    expect(minimumShortfall([...hours('2026-10-17', 17, 2), ...hours('2026-10-18', 17, 2)])).toMatch(/1 more one-hour block\./);
  });
  it('refuses 5 blocks on 1 day, naming the missing day', () => {
    expect(minimumShortfall(hours('2026-10-17', 17, 5))).toMatch(/at least 2 different days/);
  });
  it('refuses an evening across viewer midnight that is one guild day', () => {
    expect(minimumShortfall(hours('2026-10-18', 1, 5))).toMatch(/different days/);
  });
  it('names both shortfalls together', () => {
    expect(minimumShortfall(hours('2026-10-17', 17, 2))).toMatch(/3 more one-hour blocks and at least 2 different days/);
  });
  it('does not count two starts in one hour twice', () => {
    const picks = [...hours('2026-10-17', 17, 2), ...hours('2026-10-18', 17, 2)].flatMap((d) => [d, new Date(d.getTime() + 30 * 60_000)]);
    expect(minimumShortfall(picks)).not.toBeNull();
  });
});
