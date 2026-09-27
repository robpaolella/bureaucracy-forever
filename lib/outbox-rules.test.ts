import { describe, expect, it } from 'vitest';
import { entityKey, lockExpired, LOCK_TIMEOUT_MS, MAX_ATTEMPTS, nextAttempt, parseAck } from './outbox-rules';

describe('outbox rules', () => {
  const now = new Date('2026-10-01T00:00:00.000Z');

  it('backs off 2^attempts minutes and fails on the fifth try', () => {
    expect(nextAttempt(0, now)).toEqual({ status: 'PENDING', attempts: 1, runAfter: new Date('2026-10-01T00:02:00.000Z') });
    expect(nextAttempt(1, now)).toEqual({ status: 'PENDING', attempts: 2, runAfter: new Date('2026-10-01T00:04:00.000Z') });
    expect(nextAttempt(3, now)).toEqual({ status: 'PENDING', attempts: 4, runAfter: new Date('2026-10-01T00:16:00.000Z') });
    expect(nextAttempt(MAX_ATTEMPTS - 1, now)).toMatchObject({ status: 'FAILED', attempts: MAX_ATTEMPTS });
  });

  it('treats a lock older than five minutes as abandoned', () => {
    expect(lockExpired(null, now)).toBe(false);
    expect(lockExpired(new Date(now.getTime() - LOCK_TIMEOUT_MS + 1), now)).toBe(false);
    expect(lockExpired(new Date(now.getTime() - LOCK_TIMEOUT_MS - 1), now)).toBe(true);
  });

  it('parses ack bodies strictly', () => {
    expect(parseAck({ ok: true, result: { threadId: 't' } })).toEqual({ ok: true, result: { threadId: 't' } });
    expect(parseAck({ ok: true })).toEqual({ ok: true, result: undefined });
    expect(parseAck({ ok: false, error: 'boom' })).toEqual({ ok: false, error: 'boom' });
    expect(parseAck({ ok: false })).toEqual({ ok: false, error: 'unknown error' });
    expect(parseAck({})).toBeNull();
    expect(parseAck('yes')).toBeNull();
  });

  it('keys jobs by entity', () => {
    expect(entityKey('raid.update', { raidId: 'r1' })).toBe('raid:r1');
    expect(entityKey('application.note.post', { applicationId: 'a1', noteId: 'n1' })).toBe('application:a1');
    expect(entityKey('member.roles.sync', { discordId: '1' })).toBe('member:1');
    expect(entityKey('officers.notify', {})).toBe('officers');
  });
});
