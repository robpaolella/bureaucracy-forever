import 'server-only';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

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

/**
 * SYNC-SPEC §1.6: every bot write carries an Idempotency-Key (the Discord interaction or
 * message id). The first response under a key is stored and replayed on a repeat, so a
 * retried click cannot apply twice. Without the header the handler simply runs.
 */
export async function withIdempotency(request: Request, handler: () => Promise<Reply>): Promise<NextResponse> {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim().slice(0, 128) || null;
  if (!key) {
    const r = await handler();
    return response(r.status, r.body);
  }
  const seen = await db.botRequest.findUnique({ where: { key } });
  if (seen) return response(seen.statusCode, seen.body as Record<string, unknown>, true);
  const r = await handler();
  try {
    await db.botRequest.create({ data: { key, statusCode: r.status, body: r.body as Prisma.InputJsonValue } });
  } catch (e) {
    // Two identical requests raced: the first one's answer is the answer.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const first = await db.botRequest.findUnique({ where: { key } });
      if (first) return response(first.statusCode, first.body as Record<string, unknown>, true);
    } else {
      throw e;
    }
  }
  return response(r.status, r.body);
}
