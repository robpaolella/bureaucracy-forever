import { describe, expect, it } from 'vitest';
import { botRequestHeaders, REPLAY_WINDOW_S, signBotRequest, verifyBotRequest } from './bot-auth';

const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe('bot auth', () => {
  const secret = 'test-secret';
  const body = '{"raidId":"r1"}';
  const now = 1_800_000_000;

  it('accepts a fresh, correctly signed request', () => {
    const h = botRequestHeaders(secret, body, now);
    expect(verifyBotRequest(headers(h), body, secret, now)).toEqual({ ok: true });
    expect(verifyBotRequest(headers(h), body, secret, now + REPLAY_WINDOW_S)).toEqual({ ok: true });
  });

  it('rejects a stale timestamp, a wrong secret, a tampered body and a missing secret', () => {
    const h = botRequestHeaders(secret, body, now);
    const denied = { ok: false, status: 401, error: 'Unauthorised.' };
    expect(verifyBotRequest(headers(h), body, secret, now + REPLAY_WINDOW_S + 1)).toEqual(denied);
    expect(verifyBotRequest(headers(h), body, 'other', now)).toEqual(denied);
    expect(verifyBotRequest(headers(h), body + ' ', secret, now)).toEqual(denied);
    expect(verifyBotRequest(headers({}), body, secret, now)).toEqual(denied);
    expect(verifyBotRequest(headers({ ...h, 'x-bot-timestamp': '1.8e9' }), body, secret, now)).toEqual(denied);
    expect(verifyBotRequest(headers(h), body, undefined, now)).toMatchObject({ ok: false, status: 503 });
  });

  it('signs deterministically', () => {
    expect(signBotRequest(secret, now, body)).toBe(signBotRequest(secret, now, body));
    expect(signBotRequest(secret, now, body)).not.toBe(signBotRequest(secret, now + 1, body));
  });
});
