import { describe, expect, it } from 'vitest';
import { APPLICANT_DM_MAX, inRelayWindow, parseApplicantDm, parseApplicantEdit, relayPing } from './relay';

// SYNC-SPEC §13 worked examples: Thrall's application was created Mon 3:30 PM.
const at = (s: string) => new Date(`2026-10-${s}`);
const created = at('12T15:30:00Z');
const pending = { status: 'PENDING', createdAt: created, reopenedAt: null, decidedAt: null };

describe('inRelayWindow', () => {
  it('refuses a DM sent before the application was submitted', () => {
    expect(inRelayWindow(pending, at('12T15:00:00Z'))).toBe(false);
    expect(inRelayWindow(pending, created)).toBe(false);
    expect(inRelayWindow(pending, at('12T15:31:00Z'))).toBe(true);
  });

  it('refuses a DM during a decided period and accepts one after the reopen', () => {
    // Decided Tue 9 AM, DM A Tue 10 AM, reopened Tue 11 AM, DM B Tue 11:30 AM.
    const decided = { ...pending, status: 'DECLINED', decidedAt: at('13T09:00:00Z') };
    expect(inRelayWindow(decided, at('13T10:00:00Z'))).toBe(false);
    const reopened = { ...pending, reopenedAt: at('13T11:00:00Z') };
    expect(inRelayWindow(reopened, at('13T10:00:00Z'))).toBe(false);
    expect(inRelayWindow(reopened, at('13T11:30:00Z'))).toBe(true);
  });

  it('stores a DM sent while pending that reaches the site after the decision', () => {
    const decided = { ...pending, status: 'ACCEPTED', decidedAt: at('13T09:00:00Z') };
    expect(inRelayWindow(decided, at('13T08:59:00Z'))).toBe(true);
    expect(inRelayWindow(decided, at('13T09:00:00Z'))).toBe(false);
    expect(inRelayWindow(decided, at('13T09:01:00Z'))).toBe(false);
  });

  it('refuses a decided application with no decision time', () => {
    expect(inRelayWindow({ ...pending, status: 'DECLINED' }, at('13T08:00:00Z'))).toBe(false);
  });
});

const ID = '100000000000000001';
const valid = { discordId: ID, dmChannelId: '100000000000000002', dmMessageId: '100000000000000003', body: 'Hi', createdAt: '2026-10-12T16:00:00.000Z', attachments: [] };
const file = { id: '100000000000000009', filename: 'logs.zip', size: 40_000_000, spoiler: false };
const error = (body: Record<string, unknown>) => {
  const r = parseApplicantDm(body);
  return r.ok ? null : r.error;
};

describe('parseApplicantDm', () => {
  it('keeps the text as sent and the send time', () => {
    const r = parseApplicantDm({ ...valid, body: '  hello  ' });
    expect(r.ok && r.dm).toEqual({ ...valid, body: '  hello  ', createdAt: new Date(valid.createdAt), attachments: [] });
  });

  it('accepts 4,000 characters and refuses 4,001', () => {
    expect(error({ ...valid, body: 'a'.repeat(APPLICANT_DM_MAX) })).toBeNull();
    expect(error({ ...valid, body: 'a'.repeat(APPLICANT_DM_MAX + 1) })).toMatch(/4000/);
    expect(error({ ...valid, body: '😀'.repeat(APPLICANT_DM_MAX) })).toBeNull();
  });

  it('accepts an attachment-only DM and refuses one with neither', () => {
    const r = parseApplicantDm({ ...valid, body: '', attachments: [file] });
    expect(r.ok && r.dm.attachments).toEqual([file]);
    expect(error({ ...valid, body: '   ', attachments: [file] })).toBeNull();
    expect(error({ ...valid, body: '' })).toMatch(/text or an attachment/);
    expect(error({ ...valid, body: ' \n ' })).toMatch(/text or an attachment/);
    expect(error({ ...valid, body: undefined, attachments: undefined })).toMatch(/text or an attachment/);
  });

  it('allows ten attachments and refuses eleven or a malformed one', () => {
    expect(error({ ...valid, attachments: Array(10).fill(file) })).toBeNull();
    expect(error({ ...valid, attachments: Array(11).fill(file) })).toMatch(/At most 10/);
    expect(error({ ...valid, attachments: 'logs.zip' })).toMatch(/list/);
    for (const bad of [{ ...file, id: 'x' }, { ...file, filename: '' }, { ...file, size: -1 }, { ...file, size: 1.5 }, { ...file, spoiler: 'no' }, null]) {
      expect(error({ ...valid, attachments: [bad] })).toMatch(/attachment/);
    }
  });

  it('drops anything but the four attachment fields', () => {
    const r = parseApplicantDm({ ...valid, attachments: [{ ...file, url: 'https://cdn.example/x' }] });
    expect(r.ok && r.dm.attachments).toEqual([file]);
  });

  it('refuses malformed ids, times and text', () => {
    for (const key of ['discordId', 'dmChannelId', 'dmMessageId']) {
      expect(error({ ...valid, [key]: undefined })).toMatch(key);
      expect(error({ ...valid, [key]: '123' })).toMatch(key);
      expect(error({ ...valid, [key]: 100000000000000001 })).toMatch(key);
    }
    expect(error({ ...valid, createdAt: undefined })).toMatch(/createdAt/);
    expect(error({ ...valid, createdAt: 'yesterday' })).toMatch(/createdAt/);
    expect(error({ ...valid, createdAt: 1760284800000 })).toMatch(/createdAt/);
    expect(error({ ...valid, body: 42 })).toMatch(/body/);
  });
});

describe('relayPing', () => {
  const now = new Date('2026-10-13T12:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  const base = { direction: 'FROM_APPLICANT', copyMessageId: null, relayPingAt: null, lastOfficer: { discordId: '9', role: 'OFFICER' } };

  it('is null for an officer message and for a message that already has a copy', () => {
    expect(relayPing({ ...base, direction: 'TO_APPLICANT' }, now)).toBeNull();
    expect(relayPing({ ...base, copyMessageId: 'c1' }, now)).toBeNull();
  });
  it('names the last messaging officer while they are still an officer', () => {
    expect(relayPing(base, now)).toBe('9');
  });
  it('falls back to the role when that officer lost the role or none has messaged', () => {
    expect(relayPing({ ...base, lastOfficer: { discordId: '9', role: 'MEMBER' } }, now)).toBe('role');
    expect(relayPing({ ...base, lastOfficer: null }, now)).toBe('role');
  });
  it('stays quiet under 10 minutes after the last ping and pings again after', () => {
    expect(relayPing({ ...base, relayPingAt: ago(9) }, now)).toBeNull();
    expect(relayPing({ ...base, relayPingAt: ago(11) }, now)).toBe('9');
  });
});

describe('parseApplicantEdit', () => {
  it('keeps the text as sent and ignores attachments', () => {
    expect(parseApplicantEdit({ body: ' Hi ', attachments: [{}] }, 0)).toEqual({ ok: true, text: ' Hi ' });
  });
  it('counts characters, not UTF-16 units: 4,000 passes, 4,001 fails', () => {
    expect(parseApplicantEdit({ body: '😀'.repeat(APPLICANT_DM_MAX) }, 0).ok).toBe(true);
    expect(parseApplicantEdit({ body: 'a'.repeat(APPLICANT_DM_MAX + 1) }, 0).ok).toBe(false);
  });
  it('allows empty text only with a stored attachment', () => {
    expect(parseApplicantEdit({ body: ' ' }, 0).ok).toBe(false);
    expect(parseApplicantEdit({}, 0).ok).toBe(false);
    expect(parseApplicantEdit({ body: '' }, 1).ok).toBe(true);
  });
  it('refuses non-text', () => {
    expect(parseApplicantEdit({ body: 7 }, 1).ok).toBe(false);
  });
});
