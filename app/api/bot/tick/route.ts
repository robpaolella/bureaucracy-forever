import { NextResponse } from 'next/server';
import { runTick } from '@/lib/tick';
import { authorizeBot, NO_STORE } from '../_lib';

/** POST /api/bot/tick — run everything due (SYNC-SPEC §6). Idempotent; returns counts. */
export async function POST(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const counts = await runTick();
  return NextResponse.json(counts, { headers: NO_STORE });
}
