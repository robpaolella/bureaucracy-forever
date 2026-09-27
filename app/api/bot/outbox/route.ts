import { NextResponse } from 'next/server';
import { claimJobs } from '@/lib/outbox';
import { authorizeBot, NO_STORE } from '../_lib';

/** GET /api/bot/outbox?limit=20 — the next due jobs, marked RUNNING (SYNC-SPEC §4). */
export async function GET(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const raw = Number(new URL(request.url).searchParams.get('limit') ?? '20');
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 100) : 20;
  const jobs = await claimJobs(limit);
  return NextResponse.json({ jobs }, { headers: NO_STORE });
}
