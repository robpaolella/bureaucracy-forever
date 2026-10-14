import { describe, expect, it } from 'vitest';
import { helperRaids } from './helper-raids';

const now = new Date('2026-10-14T18:00:00Z');
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
const row = (id: string, startsAt: Date, extra: { durationMin?: number; cancelledAt?: Date; hasLootTable?: boolean } = {}) => ({
  id, name: `Raid ${id}`, startsAt, durationMin: extra.durationMin ?? 180, cancelledAt: extra.cancelledAt ?? null, hasLootTable: extra.hasLootTable ?? true,
});

describe('helperRaids', () => {
  it('keeps raids under way or starting within 12 hours, soonest first', () => {
    const list = helperRaids([
      row('cmraid000later', hours(11.5)),
      row('cmraid00toofar', hours(12.01)),
      row('cmraid000edge0', hours(12)),
      row('cmraid00underw', hours(-2)),
      row('cmraid000ended', hours(-3)),
      row('cmraid00cancel', hours(1), { cancelledAt: hours(-24) }),
      row('cmraid00notbl0', hours(2), { hasLootTable: false }),
    ], 'production', now);
    expect(list.map((r) => r.id)).toEqual(['cmraid00underw', 'cmraid00notbl0', 'cmraid000later', 'cmraid000edge0']);
  });

  it('gives each entry the fields of section 7.5, startsAt in seconds like the snapshot', () => {
    const [raid] = helperRaids([row('cm9xr2k4a0001', new Date(1792000000 * 1000), { durationMin: 240, hasLootTable: false })], 'staging', new Date(1791990000 * 1000));
    expect(raid).toEqual({ id: 'cm9xr2k4a0001', code: 'SA0001', name: 'Raid cm9xr2k4a0001', startsAt: 1792000000, durationMin: 240, hasLootTable: false });
  });

  it('is empty with no raids in the window', () => {
    expect(helperRaids([row('cmraid000ended', hours(-3))], 'production', now)).toEqual([]);
  });
});
