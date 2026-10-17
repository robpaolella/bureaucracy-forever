import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ db: { application: { findUnique: mocks.findUnique, updateMany: mocks.updateMany } } }));
import { applyNudgeAck, loadReminder, parseReminderKey, pacificDay, pendingReminder } from './application-reminders';

const ACTIVITY = new Date('2026-10-12T23:00:00Z');
const KEY = `${ACTIVITY.toISOString()}@2026-10-13`;
const app = (over: Record<string, unknown> = {}) => ({
  status: 'PENDING', createdAt: ACTIVITY, reopenedAt: null, reminderKey: KEY, notes: [], interviews: [], ...over,
}) as Parameters<typeof pendingReminder>[0];
const EVENING = new Date('2026-10-14T02:00:00Z'); // Tue Oct 13, 7 PM Pacific

describe('pacificDay', () => {
  it('is the calendar day in Pacific, not UTC', () => {
    expect(pacificDay(EVENING)).toBe('2026-10-13');
    expect(pacificDay(new Date('2026-10-14T07:00:00Z'))).toBe('2026-10-14');
  });
});

describe('parseReminderKey', () => {
  it('splits activity time and day', () => {
    expect(parseReminderKey(KEY)).toEqual({ activityAt: ACTIVITY, day: '2026-10-13' });
  });
  it('rejects anything else', () => {
    expect(parseReminderKey('opaque')).toBeNull();
    expect(parseReminderKey('nonsense@2026-10-13')).toBeNull();
  });
});

describe('pendingReminder', () => {
  it('is present while the key is valid', () => {
    expect(pendingReminder(app(), EVENING)).toEqual({ key: KEY, line: 'waiting', at: ACTIVITY.toISOString(), interviewId: null });
  });
  it('carries the latest attempt for a booking owed', () => {
    const t = new Date('2026-10-12T22:00:00Z');
    const i = { id: 'i1', attempt: 1, status: 'TIMES_RECEIVED' as const, requestedAt: new Date('2026-10-12T20:00:00Z'), timesUpdatedAt: t, proposedAt: null, bookedAt: null, bookedStart: null, endedAt: null };
    expect(pendingReminder(app({ interviews: [i] }), EVENING)).toMatchObject({ line: 'booking_owed', at: t.toISOString(), interviewId: 'i1' });
  });
  it('is null without a key', () => expect(pendingReminder(app({ reminderKey: null }), EVENING)).toBeNull());
  it('is null once decided', () => expect(pendingReminder(app({ status: 'ACCEPTED' }), EVENING)).toBeNull());
  it('is null once activity moved past the key', () => {
    expect(pendingReminder(app({ notes: [{ createdAt: new Date('2026-10-13T20:00:00Z') }] }), EVENING)).toBeNull();
  });
  it('is null once quiet', () => {
    const i = { id: 'i1', attempt: 1, status: 'AWAITING_TIMES' as const, requestedAt: ACTIVITY, timesUpdatedAt: null, proposedAt: null, bookedAt: null, bookedStart: null, endedAt: null };
    expect(pendingReminder(app({ interviews: [i] }), EVENING)).toBeNull();
  });
  it('is null after midnight Pacific of its day, present just before', () => {
    expect(pendingReminder(app(), new Date('2026-10-14T06:59:59Z'))).not.toBeNull();
    expect(pendingReminder(app(), new Date('2026-10-14T07:00:00Z'))).toBeNull();
  });
  it('is null for a key it cannot read', () => expect(pendingReminder(app({ reminderKey: 'junk' }), EVENING)).toBeNull());
});

describe('loadReminder', () => {
  const row = { ...app(), reminderChannelId: null, reminderMessageId: null };
  beforeEach(() => mocks.findUnique.mockReset());
  it('is null for an unknown application', async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await loadReminder('x', EVENING)).toBeNull();
  });
  it('returns the live ids whatever the status', async () => {
    mocks.findUnique.mockResolvedValue({ ...row, status: 'DECLINED', reminderChannelId: 'c', reminderMessageId: 'm' });
    expect(await loadReminder('a', EVENING)).toEqual({ pending: null, live: { channelId: 'c', messageId: 'm' } });
  });
  it('has no live reminder without both ids', async () => {
    mocks.findUnique.mockResolvedValue({ ...row, reminderChannelId: 'c' });
    expect((await loadReminder('a', EVENING))?.live).toBeNull();
  });
  it('counts soft-deleted notes toward activity by not filtering them', async () => {
    mocks.findUnique.mockResolvedValue(row);
    await loadReminder('a', EVENING);
    expect(mocks.findUnique.mock.calls[0][0].select.notes).toEqual({ select: { createdAt: true } });
  });
});

describe('applyNudgeAck', () => {
  type Row = { reminderKey: string | null; reminderActivityAt: Date | null; reminderCount: number; reminderChannelId: string | null; reminderMessageId: string | null; reminderLastOn: string | null };
  let row: Row;
  beforeEach(() => {
    row = { reminderKey: KEY, reminderActivityAt: null, reminderCount: 0, reminderChannelId: null, reminderMessageId: null, reminderLastOn: null };
    // An in-memory stand-in that evaluates the where like the database does, atomically.
    mocks.updateMany.mockReset().mockImplementation(async ({ where, data }) => {
      if (where.reminderKey !== row.reminderKey) return { count: 0 };
      if ('reminderActivityAt' in where && where.reminderActivityAt.getTime() !== row.reminderActivityAt?.getTime()) return { count: 0 };
      const { reminderCount, ...rest } = data;
      Object.assign(row, rest);
      if (reminderCount !== undefined) row.reminderCount = typeof reminderCount === 'number' ? reminderCount : row.reminderCount + reminderCount.increment;
      return { count: 1 };
    });
  });
  const ids = { channelId: 'c1', messageId: 'm1' };

  it('stores the ids, counts, records the day and clears the key', async () => {
    expect(await applyNudgeAck('a', KEY, ids)).toBe('reminder recorded');
    expect(row).toMatchObject({ reminderKey: null, reminderChannelId: 'c1', reminderMessageId: 'm1', reminderLastOn: '2026-10-13', reminderCount: 1, reminderActivityAt: ACTIVITY });
  });
  it('adds one when the activity time is the same', async () => {
    row.reminderActivityAt = ACTIVITY; row.reminderCount = 2;
    await applyNudgeAck('a', KEY, ids);
    expect(row.reminderCount).toBe(3);
  });
  it('restarts at 1 when the activity time differs', async () => {
    row.reminderActivityAt = new Date('2026-10-01T00:00:00Z'); row.reminderCount = 4;
    await applyNudgeAck('a', KEY, ids);
    expect(row).toMatchObject({ reminderCount: 1, reminderActivityAt: ACTIVITY });
  });
  it('changes nothing for a stale key', async () => {
    row.reminderKey = '2026-10-13T00:00:00.000Z@2026-10-14';
    const before = { ...row };
    expect(await applyNudgeAck('a', KEY, ids)).toBe('stale reminder ignored');
    expect(row).toEqual(before);
  });
  it('clears a matching key without counting on skipped', async () => {
    expect(await applyNudgeAck('a', KEY, { skipped: 'decided' })).toBe('reminder skipped');
    expect(row).toMatchObject({ reminderKey: null, reminderCount: 0, reminderChannelId: null, reminderLastOn: null });
  });
  it('ignores a stale skip', async () => {
    row.reminderKey = null;
    expect(await applyNudgeAck('a', KEY, { skipped: 'x' })).toBe('stale reminder ignored');
  });
  it('applies once when two acks race', async () => {
    await Promise.all([applyNudgeAck('a', KEY, ids), applyNudgeAck('a', KEY, ids)]);
    expect(row.reminderCount).toBe(1);
  });
});
