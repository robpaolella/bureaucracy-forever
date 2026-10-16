import { describe, expect, it } from 'vitest';
import { dueForClose, dueForLock, dueForNudge, dueForPost, interviewDone, interviewExpired, interviewHeadsUpDue, interviewReminderDue, joinNoticeDue, proposalLapsed, reminderDue, type TickInterview, type TickRaid } from './tick-rules';

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

describe('interview tick rules', () => {
  const start = new Date('2026-10-20T20:00:00.000Z');
  const at = (min: number) => new Date(start.getTime() + min * 60_000);
  const iv = (over: Partial<TickInterview> = {}): TickInterview => ({ status: 'BOOKED', requestedAt: new Date('2026-10-10T00:00:00.000Z'), proposedStart: null, bookedStart: start, remindedAt: null, headsUpAt: null, joinedNotifiedAt: null, ...over });
  const requested = iv().requestedAt;
  const afterDays = (d: number, extraMs = 0) => new Date(requested.getTime() + d * 86_400_000 + extraMs);

  it('reminds from 5 minutes ahead (a late restart at 2 minutes still does), never at or after the start', () => {
    expect(interviewReminderDue(iv(), at(-6))).toBe(false);
    expect(interviewReminderDue(iv(), at(-5))).toBe(true);
    expect(interviewReminderDue(iv(), at(-2))).toBe(true);
    expect(interviewReminderDue(iv(), at(0))).toBe(false);
    expect(interviewReminderDue(iv(), at(1))).toBe(false);
    expect(interviewReminderDue(iv({ remindedAt: at(-5) }), at(-2))).toBe(false);
    expect(interviewReminderDue(iv({ status: 'PROPOSED' }), at(-2))).toBe(false);
  });
  it('expires unbooked requests at 7 days', () => {
    expect(interviewExpired(iv({ status: 'AWAITING_TIMES' }), afterDays(7, -1))).toBe(false);
    expect(interviewExpired(iv({ status: 'AWAITING_TIMES' }), afterDays(7))).toBe(true);
    expect(interviewExpired(iv({ status: 'TIMES_RECEIVED' }), afterDays(7))).toBe(true);
    expect(interviewExpired(iv({ status: 'PROPOSED' }), afterDays(8))).toBe(false);
    expect(interviewExpired(iv(), afterDays(8))).toBe(false);
  });
  it('gives one heads-up at 3 days, only while still awaiting times', () => {
    expect(interviewHeadsUpDue(iv({ status: 'AWAITING_TIMES' }), afterDays(3, -1))).toBe(false);
    expect(interviewHeadsUpDue(iv({ status: 'AWAITING_TIMES' }), afterDays(3))).toBe(true);
    expect(interviewHeadsUpDue(iv({ status: 'AWAITING_TIMES', headsUpAt: afterDays(3) }), afterDays(4))).toBe(false);
    expect(interviewHeadsUpDue(iv({ status: 'TIMES_RECEIVED' }), afterDays(4))).toBe(false);
  });
  it('lapses a proposal when its start arrives', () => {
    expect(proposalLapsed(iv({ status: 'PROPOSED', proposedStart: start }), at(-1))).toBe(false);
    expect(proposalLapsed(iv({ status: 'PROPOSED', proposedStart: start }), at(0))).toBe(true);
    expect(proposalLapsed(iv({ status: 'BOOKED', proposedStart: start }), at(5))).toBe(false);
  });
  it('finishes a booking 60 minutes after its start', () => {
    expect(interviewDone(iv(), at(59))).toBe(false);
    expect(interviewDone(iv(), at(60))).toBe(true);
    expect(interviewDone(iv({ status: 'DONE' }), at(90))).toBe(false);
  });
  it('announces a join from 15 minutes ahead to 30 minutes ago, once', () => {
    expect(joinNoticeDue(iv(), at(-16))).toBe(false);
    expect(joinNoticeDue(iv(), at(-15))).toBe(true);
    expect(joinNoticeDue(iv(), at(30))).toBe(true);
    expect(joinNoticeDue(iv(), at(31))).toBe(false);
    expect(joinNoticeDue(iv({ joinedNotifiedAt: at(-10) }), at(0))).toBe(false);
    expect(joinNoticeDue(iv({ status: 'PROPOSED' }), at(0))).toBe(false);
  });
});
