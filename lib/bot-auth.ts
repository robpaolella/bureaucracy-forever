/**
 * The shared-secret handshake between the site and the Discord bot (docs/06 § Discord bot
 * sync; roadmap Phase 6): HMAC-SHA256 over `<timestamp>.<raw body>`, sent as
 * `X-Bot-Timestamp` (unix seconds) and `X-Bot-Signature` (hex). A five-minute window
 * bounds replays. Pure apart from the crypto so both directions share one definition.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TIMESTAMP_HEADER = 'x-bot-timestamp';
export const SIGNATURE_HEADER = 'x-bot-signature';
/**
 * Accepted skew. There is no nonce store, so a captured request can be replayed inside
 * this window; every signed operation is an idempotent upsert or a read, which is why
 * that trade is acceptable for a two-party link on one guild.
 */
export const REPLAY_WINDOW_S = 5 * 60;
/** Bodies the bot sends are small; anything larger is refused before it is read. */
export const MAX_BODY_BYTES = 64 * 1024;
const UNAUTHORISED = 'Unauthorised.';

export function signBotRequest(secret: string, timestamp: number, rawBody: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export type BotAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Verify a request from the bot. `now` is unix seconds, injectable for tests. */
export function verifyBotRequest(headers: { get(name: string): string | null }, rawBody: string, secret: string | undefined, now = Math.floor(Date.now() / 1000)): BotAuthResult {
  if (!secret) return { ok: false, status: 503, error: 'Bot sync is not configured.' };
  // One message for every failure: the caller learns nothing about which check tripped.
  const rawTs = headers.get(TIMESTAMP_HEADER) ?? '';
  if (!/^\d{1,10}$/.test(rawTs)) return { ok: false, status: 401, error: UNAUTHORISED };
  const ts = Number(rawTs);
  if (Math.abs(now - ts) > REPLAY_WINDOW_S) return { ok: false, status: 401, error: UNAUTHORISED };
  const expected = signBotRequest(secret, ts, rawBody);
  const a = Buffer.from(headers.get(SIGNATURE_HEADER) ?? '', 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: UNAUTHORISED };
  return { ok: true };
}

/** Headers for a request the site sends to the bot, signed the same way. */
export function botRequestHeaders(secret: string, rawBody: string, now = Math.floor(Date.now() / 1000)): Record<string, string> {
  return { 'Content-Type': 'application/json', [TIMESTAMP_HEADER]: String(now), [SIGNATURE_HEADER]: signBotRequest(secret, now, rawBody) };
}
