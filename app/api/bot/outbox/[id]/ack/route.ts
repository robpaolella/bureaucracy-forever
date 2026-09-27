import { NextResponse } from 'next/server';
import { ackJob } from '@/lib/outbox';
import { parseAck } from '@/lib/outbox-rules';
import { authorizeBot, NO_STORE, readJson } from '../../../_lib';

/** POST /api/bot/outbox/:id/ack — `{ ok: true, result? }` or `{ ok: false, error }` (SYNC-SPEC §4). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const ack = parseAck(read.body);
  if (!ack) return NextResponse.json({ error: 'Send { ok: true, result? } or { ok: false, error }.' }, { status: 400, headers: NO_STORE });
  const { id } = await params;
  const outcome = await ackJob(id, ack);
  if (!outcome) return NextResponse.json({ error: 'No such job.' }, { status: 404, headers: NO_STORE });
  return NextResponse.json(outcome, { headers: NO_STORE });
}
