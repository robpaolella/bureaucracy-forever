import 'server-only';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';

export const IDEMPOTENCY_HEADER = 'idempotency-key';
const NO_STORE = { 'Cache-Control': 'private, no-store' };

export type Reply = { status: number; body: Record<string, unknown> };

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
    return NextResponse.json(r.body, { status: r.status, headers: NO_STORE });
  }
  const seen = await db.botRequest.findUnique({ where: { key } });
  if (seen) return NextResponse.json(seen.body as Record<string, unknown>, { status: seen.statusCode, headers: { ...NO_STORE, 'Idempotent-Replay': 'true' } });
  const r = await handler();
  try {
    await db.botRequest.create({ data: { key, statusCode: r.status, body: r.body as Prisma.InputJsonValue } });
  } catch (e) {
    // Two identical requests raced: the first one's answer is the answer.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const first = await db.botRequest.findUnique({ where: { key } });
      if (first) return NextResponse.json(first.body as Record<string, unknown>, { status: first.statusCode, headers: { ...NO_STORE, 'Idempotent-Replay': 'true' } });
    } else {
      throw e;
    }
  }
  return NextResponse.json(r.body, { status: r.status, headers: NO_STORE });
}
