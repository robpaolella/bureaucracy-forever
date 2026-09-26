import { describe, expect, it } from 'vitest';
import { parseBotApplication, parseBotSignup } from './bot-inbound';

describe('bot payloads', () => {
  it('parses a sign-up by raid id or Discord event id', () => {
    expect(parseBotSignup({ raidId: 'r1', discordId: '100000000010000000', discordName: 'Redtape', response: 'accept' })).toMatchObject({ ok: true, value: { raidId: 'r1', response: 'accept', reason: null, role: null, at: null } });
    expect(parseBotSignup({ raidId: 'r1', discordId: '100000000010000000', discordName: 'Redtape', response: 'accept', role: 'member', at: 1_800_000_000 })).toMatchObject({ ok: true, value: { role: 'member', at: 1_800_000_000 } });
    expect(parseBotSignup({ raidId: 'r1', discordId: '100000000010000000', discordName: 'Redtape', response: 'accept', role: 'guest' })).toMatchObject({ ok: false, error: /role/ });
    expect(parseBotSignup({ discordEventId: '123456789012345678', discordId: '100000000010000000', discordName: 'Redtape', response: null })).toMatchObject({ ok: true, value: { discordEventId: '123456789012345678', response: null } });
    expect(parseBotSignup({ discordId: '100000000010000000', discordName: 'x', response: 'accept' })).toMatchObject({ ok: false, error: /raidId/ });
    expect(parseBotSignup({ raidId: 'r1', discordId: 'abc', discordName: 'x', response: 'accept' })).toMatchObject({ ok: false, error: /discordId/ });
    expect(parseBotSignup({ raidId: 'r1', discordId: '100000000010000000', discordName: 'x', response: 'maybe' })).toMatchObject({ ok: false, error: /response/ });
  });

  it('parses a Discord application, dropping what it cannot use', () => {
    const r = parseBotApplication({ path: 'raider', discordId: '100000000010000000', discordName: 'footnote', character: 'footNOTE', wowClass: 'priest', spec: 'Holy', logsUrl: 'javascript:alert(1)', alts: 'Margin', referredBy: 'Redtape', extra: '' });
    expect(r).toMatchObject({ ok: true, value: { character: 'Footnote', wowClass: 'priest', spec: 'Holy', logsUrl: null, answers: { alts: 'Margin', referredBy: 'Redtape' } } });
    expect(parseBotApplication({ path: 'guest', discordId: '100000000010000000', discordName: 'x', character: 'Abc' })).toMatchObject({ ok: false, error: /path/ });
    expect(parseBotApplication({ path: 'social', discordId: '100000000010000000', discordName: 'x', character: 'A' })).toMatchObject({ ok: false, error: /letters/ });
  });
});
