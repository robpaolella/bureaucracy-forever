import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authorizeBot, NO_STORE } from '../_lib';
import { broadcastDenied, raidSummary } from './_broadcast';

const WINDOW_MS = 7 * 24 * 60 * 60_000;
const MAX_RAIDS = 25;

/**
 * GET /api/bot/raids?byDiscordId= — raids from 7 days ago onward, any status, earliest first,
 * at most 25, for the officer's /broadcast By raid picker (SYNC-SPEC §14). Read-only.
 */
export async function GET(request: Request) {
  const denied = authorizeBot(request) ?? (await broadcastDenied(request));
  if (denied) return denied;
  const raids = await db.raid.findMany({
    where: { startsAt: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { startsAt: 'asc' },
    take: MAX_RAIDS,
    select: { id: true, name: true, startsAt: true, status: true },
  });
  return NextResponse.json({ raids: raids.map(raidSummary) }, { headers: NO_STORE });
}
