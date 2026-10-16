import 'server-only';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** A `BotRequest` row with this status is a claim on a key whose first request is still running. */
const CLAIMED = 0;
/**
 * A claim older than this is treated as abandoned (a crashed or timed-out first attempt) and
 * may be taken over. The bot routes set no `maxDuration`, so Vercel's default applies: 300 s
 * with Fluid compute (800 s is the most any plan allows). 15 minutes is safely past both.
 */
export const CLAIM_LIFETIME_MS = 15 * 60_000;
/** How long a repeat waits for the first request's reply before refusing with `in_progress`. */
export const WAIT_MS = 10_000;
const POLL_MS = 200;

export type Reply = { status: number; body: Record<string, unknown> };

function response(status: number, body: Record<string, unknown>, replay = false): NextResponse {
  const headers = { ...NO_STORE, ...(replay ? { 'Idempotent-Replay': 'true' } : {}) };
  return [204, 205, 304].includes(status)
    ? new NextResponse(null, { status, headers })
    : NextResponse.json(body, { status, headers });
}

export function reply(status: number, body: Record<string, unknown>): Reply {
  return { status, body };
}

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** Claims `key`, returning the claim's `createdAt`, the stored row if one blocks it, or null to wait. */
async function claim(key: string): Promise<{ claimedAt: Date } | { stored: Reply } | null> {
  const claimedAt = new Date();
  try {
    await db.botRequest.create({ data: { key, statusCode: CLAIMED, body: {}, createdAt: claimedAt } });
    return { claimedAt };
  } catch (e) {
    if (!isDuplicate(e)) throw e;
  }
  const seen = await db.botRequest.findUnique({ where: { key } });
  if (!seen) return null; // released between our insert and read; claim again on the next poll
  if (seen.statusCode !== CLAIMED) return { stored: { status: seen.statusCode, body: seen.body as Record<string, unknown> } };
  if (claimedAt.getTime() - seen.createdAt.getTime() < CLAIM_LIFETIME_MS) return null;
  // Abandoned: take it over only if no one else already has (the old createdAt still matches).
  const taken = await db.botRequest.updateMany({ where: { key, statusCode: CLAIMED, createdAt: seen.createdAt }, data: { createdAt: claimedAt } });
  return taken.count === 1 ? { claimedAt } : null;
}

/**
 * SYNC-SPEC §1.6: every bot write carries an Idempotency-Key (the Discord interaction or
 * message id). The first request claims the key before its handler runs, so a key only ever
 * executes once. Its reply (2xx or 4xx) is stored and replayed on a repeat; a throw or 5xx
 * releases the claim so a retry can run. A repeat that arrives while the first is still
 * running waits up to WAIT_MS for its reply, then gets 409 `in_progress`. Without the header
 * the handler simply runs.
 */
export async function withIdempotency(request: Request, handler: () => Promise<Reply>): Promise<NextResponse> {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim().slice(0, 128) || null;
  if (!key) {
    const r = await handler();
    return response(r.status, r.body);
  }
  const deadline = Date.now() + WAIT_MS;
  let claimed = await claim(key);
  while (claimed === null) {
    if (Date.now() >= deadline) return response(409, { reason: 'in_progress', error: 'That request is still being handled. Try again in a moment.' });
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    claimed = await claim(key);
  }
  if ('stored' in claimed) return response(claimed.stored.status, claimed.stored.body, true);

  const mine = { key, statusCode: CLAIMED, createdAt: claimed.claimedAt };
  let r: Reply;
  try {
    r = await handler();
  } catch (e) {
    await db.botRequest.deleteMany({ where: mine });
    throw e;
  }
  if (r.status >= 500) await db.botRequest.deleteMany({ where: mine });
  else await db.botRequest.updateMany({ where: mine, data: { statusCode: r.status, body: r.body as Prisma.InputJsonValue } });
  return response(r.status, r.body);
}
