import { describe, expect, it } from 'vitest';
import { reserveReminderDue, reserveReminderRecipients, type ReminderSignup } from './reserve-reminder';
import { entityKey } from './outbox-rules';

const raid = { status: 'SCHEDULED', startsAt: new Date('2026-10-16T20:00:00Z'), postedAt: new Date('2026-10-01'), remindReservesAt: null };
const now = new Date('2026-10-16T17:00:00Z');
describe('reserve reminder due', () => {
  it.each([['15:59:59.999', false], ['16:00:00', true], ['17:59:59.999', true], ['18:00:00', false], ['20:00:00', false]])('%s → %s', (time, due) => {
    expect(reserveReminderDue(raid, new Date(`2026-10-16T${time}Z`), true, true)).toBe(due);
  });
  it('allows a signup-locked raid', () => expect(reserveReminderDue({ ...raid, status: 'LOCKED' }, now, true, true)).toBe(true));
  it.each([{ status: 'CANCELLED' }, { status: 'DONE' }, { postedAt: null }, { remindReservesAt: now }])('rejects %o', (patch) => {
    expect(reserveReminderDue({ ...raid, ...patch }, now, true, true)).toBe(false);
  });
  it('requires the flag and a nonempty table', () => {
    expect(reserveReminderDue(raid, now, false, true)).toBe(false);
    expect(reserveReminderDue(raid, now, true, false)).toBe(false);
  });
});
function signup(userId: string, response: ReminderSignup['response'] = 'ACCEPT', character = true) {
  return { userId, response, standing: 'BENCH', user: { discordId: `discord-${userId}`, characters: character ? [{ id: `char-${userId}` }] : [] } };
}
describe('reserve reminder recipients', () => {
  it('includes accepted/tentative bench members, not absent, unanswered or characterless members', () => {
    expect(reserveReminderRecipients([signup('a'), signup('b', 'TENTATIVE'), signup('c', 'ABSENT'), signup('d', null), signup('e', 'ACCEPT', false)], [])).toEqual(['discord-a', 'discord-b']);
  });
  it('counts officer picks for their holder and reminds either partial pick', () => {
    const reserves = [{ userId: 'a', kind: 'HR' as const, setById: 'officer' }, { userId: 'a', kind: 'SR' as const, setById: 'officer' }, { userId: 'b', kind: 'HR' as const }, { userId: 'c', kind: 'SR' as const }];
    expect(reserveReminderRecipients([signup('a'), signup('b'), signup('c')], reserves)).toEqual(['discord-b', 'discord-c']);
  });
  it('handles no signups', () => expect(reserveReminderRecipients([], [])).toEqual([]));
  it('shares raid ordering', () => expect(entityKey('raid.reserves.remind', { raidId: 'r' })).toBe(entityKey('raid.update', { raidId: 'r' })));
});
