import { NextResponse } from 'next/server';
import { authorizeBot, NO_STORE } from '../_lib';

/** GET /api/bot/health — `{ ok: true, version }` (SYNC-SPEC §4). */
export async function GET(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev' }, { headers: NO_STORE });
}
