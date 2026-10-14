/**
 * The loot helper's API (ADDON-SPEC section 7): the one guard every `/api/helper/*` route runs
 * first, and the error shape they all answer with. Order matters: the switch, then an address
 * that has failed too often, then size, then the key, then the key's own rate. A failed
 * address is refused before its key is looked at, so guessing stops for the rest of the minute.
 */
import 'server-only';

import { NextResponse } from 'next/server';
import type { SiteEnv } from '@/lib/addon-operations';
import { isStagingDeployment } from '@/lib/deploy-env';
import { helperEnabled } from '@/lib/flags';
import { recordHelperKeyUse, verifyHelperKey } from '@/lib/helper-keys';
import { clientAddress, limitReached, rateLimited, retryAfterSeconds } from '@/lib/rate-limit';

/** Section 7.6, accepted by Robert (addon#3 change log, 2026-10-13). */
export const HELPER_LIMITS = {
  operations: 100,
  bodyBytes: 64 * 1024,
  requestsPerKey: 30,
  failedAuthPerAddress: 10,
  windowMs: 60_000,
} as const;

export const HELPER_NO_STORE = { 'Cache-Control': 'private, no-store' };

/** This site's environment, as records carry it (section 2). The upload compares each record's against it. */
export function siteEnv(env: Record<string, string | undefined> = process.env): SiteEnv {
  return isStagingDeployment(env) ? 'staging' : 'production';
}

export function helperError(status: number, code: string, error: string, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json({ error, code }, { status, headers: { ...HELPER_NO_STORE, ...headers } });
}

const tooLarge = () => helperError(413, 'too-large', `The request is over ${HELPER_LIMITS.bodyBytes / 1024} KiB.`);
const slowDown = (bucket: string) =>
  helperError(429, 'rate-limited', 'Too many requests. Wait a minute and try again.', { 'Retry-After': String(retryAfterSeconds(bucket)) });

export type HelperCaller = { userId: string; keyId: string; body: unknown };

/**
 * Checks a helper request. `body: true` reads and parses the JSON body (within the size limit);
 * otherwise `body` is undefined. Answers the caller, or the refusal to send back.
 */
export async function guardHelperRequest(request: Request, options: { body?: boolean } = {}): Promise<HelperCaller | { deny: NextResponse }> {
  if (!helperEnabled()) return { deny: helperError(404, 'not-enabled', 'The loot helper isn’t switched on for this site.') };

  const failures = `helper-auth-fail:${clientAddress(request.headers)}`;
  if (limitReached(failures, HELPER_LIMITS.failedAuthPerAddress)) return { deny: slowDown(failures) };

  const length = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(length) || length > HELPER_LIMITS.bodyBytes) return { deny: tooLarge() };

  const authorization = request.headers.get('authorization') ?? '';
  const key = /^Bearer\s+(\S+)$/i.exec(authorization.trim())?.[1];
  const verified = await verifyHelperKey(key);
  if (!verified.ok) {
    if (rateLimited(failures, HELPER_LIMITS.failedAuthPerAddress, HELPER_LIMITS.windowMs)) return { deny: slowDown(failures) };
    return {
      deny: verified.status === 403
        ? helperError(403, 'not-officer', 'This key’s owner is no longer an officer.')
        : helperError(401, 'bad-key', 'That helper key isn’t recognised. It may have been revoked, or be from the other site.'),
    };
  }

  const perKey = `helper-key:${verified.keyId}`;
  if (rateLimited(perKey, HELPER_LIMITS.requestsPerKey, HELPER_LIMITS.windowMs)) return { deny: slowDown(perKey) };

  let body: unknown;
  if (options.body) {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > HELPER_LIMITS.bodyBytes) return { deny: tooLarge() };
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      return { deny: helperError(400, 'bad-json', 'The request body isn’t valid JSON.') };
    }
  }

  await recordHelperKeyUse(verified.keyId);
  return { userId: verified.userId, keyId: verified.keyId, body };
}
