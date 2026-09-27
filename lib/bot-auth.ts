/**
 * Bot → site authentication (SYNC-SPEC §2): `Authorization: Bearer <BOT_SHARED_SECRET>` on
 * every request to /api/bot/*, compared in constant time. The site never calls the bot.
 */
import { timingSafeEqual } from 'node:crypto';

export type BotAuthResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

export function bearerToken(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(header ?? '');
  return m ? m[1] : null;
}

export function verifyBearer(header: string | null, secret: string | undefined): BotAuthResult {
  if (!secret) return { ok: false, status: 503, error: 'Bot sync is not configured.' };
  const given = bearerToken(header);
  if (!given) return { ok: false, status: 401, error: 'Unauthorised.' };
  const a = Buffer.from(given, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: 'Unauthorised.' };
  return { ok: true };
}
