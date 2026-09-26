/**
 * The shared-secret handshake between the site and the Discord bot (docs/06 § Discord bot
 * sync; roadmap Phase 6): HMAC-SHA256 over `<timestamp>.<raw body>`, sent as
 * `X-Bot-Timestamp` (unix seconds) and `X-Bot-Signature` (hex). A five-minute window
 * bounds replays. Pure apart from the crypto so both directions share one definition.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TIMESTAMP_HEADER = 'x-bot-timestamp';
export const SIGNATURE_HEADER = 'x-bot-signature';
export const REPLAY_WINDOW_S = 5 * 60;

export function signBotRequest(secret: string, timestamp: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export type BotAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Verify a request from the bot. `now` is unix seconds, injectable for tests. */
export function verifyBotRequest(headers: { get(name: string): string | null }, rawBody: string, secret: string | undefined, now = Math.floor(Date.now() / 1000)): BotAuthResult {
  if (!secret) return { ok: false, status: 503, error: 'Bot sync is not configured.' };
  const ts = Number(headers.get(TIMESTAMP_HEADER));
  const given = headers.get(SIGNATURE_HEADER) ?? '';
  if (!Number.isInteger(ts) || Math.abs(now - ts) > REPLAY_WINDOW_S) return { ok: false, status: 401, error: 'Stale or missing timestamp.' };
  const expected = signBotRequest(secret, ts, rawBody);
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: 'Bad signature.' };
  return { ok: true };
}

/** Headers for a request the site sends to the bot, signed the same way. */
export function botRequestHeaders(secret: string, rawBody: string, now = Math.floor(Date.now() / 1000)): Record<string, string> {
  return { 'Content-Type': 'application/json', [TIMESTAMP_HEADER]: String(now), [SIGNATURE_HEADER]: signBotRequest(secret, now, rawBody) };
}
