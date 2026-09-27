import { describe, expect, it } from 'vitest';
import { dueForClose, dueForLock, dueForNudge, dueForPost, reminderDue, type TickRaid } from './tick-rules';

const startsAt = new Date('2026-10-16T03:00:00.000Z');
const raid = (over: Partial<TickRaid> = {}): TickRaid => ({ status: 'SCHEDULED', startsAt, durationMin: 180, locksAt: new Date(startsAt.getTime() - 120 * 60_000), postedAt: null, remind72At: null, remind24At: null, ...over });
const h = (n: number) => new Date(startsAt.getTime() - n * 3_600_000);

describe('tick rules', () => {
  it('posts inside the post-ahead window and never for the past', () => {
    expect(dueForPost(raid(), h(15 * 24), 14)).toBe(false);
    expect(dueForPost(raid(), h(14 * 24), 14)).toBe(true);
    expect(dueForPost(raid({ postedAt: h(20 * 24) }), h(10 * 24), 14)).toBe(false);
    expect(dueForPost(raid(), h(-1), 14)).toBe(false);
  });

  it('reminds at 72 h then 24 h, only once each, only when posted and unlocked', () => {
    const posted = raid({ postedAt: h(14 * 24) });
    expect(reminderDue(posted, h(73))).toBeNull();
    expect(reminderDue(posted, h(72))).toBe(72);
    expect(reminderDue({ ...posted, remind72At: h(72) }, h(30))).toBeNull();
    expect(reminderDue({ ...posted, remind72At: h(72) }, h(24))).toBe(24);
    expect(reminderDue({ ...posted, remind72At: h(72), remind24At: h(24) }, h(3))).toBeNull();
    expect(reminderDue({ ...posted, status: 'LOCKED' }, h(1))).toBeNull();
    expect(reminderDue(raid(), h(24))).toBeNull();
    // A raid posted late gets the 24 h reminder straight away, not the stale 72 h one first.
    expect(reminderDue(posted, h(20))).toBe(24);
  });

  it('locks at locksAt and closes an hour after the night', () => {
    expect(dueForLock(raid(), h(2.01))).toBe(false);
    expect(dueForLock(raid(), h(2))).toBe(true);
    expect(dueForLock(raid({ status: 'LOCKED' }), h(1))).toBe(false);
    const locked = raid({ status: 'LOCKED' });
    expect(dueForClose(locked, new Date(startsAt.getTime() + 3.9 * 3_600_000))).toBe(false);
    expect(dueForClose(locked, new Date(startsAt.getTime() + 4 * 3_600_000))).toBe(true);
    expect(dueForClose(raid(), new Date(startsAt.getTime() + 5 * 3_600_000))).toBe(false);
  });

  it('nudges a pending application once after a day', () => {
    const created = new Date('2026-10-01T00:00:00.000Z');
    expect(dueForNudge({ status: 'PENDING', createdAt: created, nudgedAt: null }, new Date('2026-10-01T23:59:00.000Z'))).toBe(false);
    expect(dueForNudge({ status: 'PENDING', createdAt: created, nudgedAt: null }, new Date('2026-10-02T00:01:00.000Z'))).toBe(true);
    expect(dueForNudge({ status: 'PENDING', createdAt: created, nudgedAt: created }, new Date('2026-10-03T00:00:00.000Z'))).toBe(false);
    expect(dueForNudge({ status: 'ACCEPTED', createdAt: created, nudgedAt: null }, new Date('2026-10-03T00:00:00.000Z'))).toBe(false);
  });
});
