import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authorizeBot, NO_STORE } from '../../../_lib';
import { broadcastDenied, raidSummary } from '../../_broadcast';

/**
 * GET /api/bot/raids/:id/signups?byDiscordId= — every sign-up row of one raid by Discord id,
 * for /broadcast By raid (SYNC-SPEC §14). Officers only; the officer check runs before the
 * raid lookup so a non-officer learns nothing about which raids exist. Read-only.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request) ?? (await broadcastDenied(request));
  if (denied) return denied;
  const { id } = await params;
  const raid = await db.raid.findUnique({
    where: { id },
    select: { id: true, name: true, startsAt: true, status: true, signups: { select: { response: true, standing: true, user: { select: { discordId: true } } } } },
  });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  const signups = raid.signups.map((s) => ({ discordId: s.user.discordId, response: s.response, standing: s.standing }));
  return NextResponse.json({ raid: raidSummary(raid), signups }, { headers: NO_STORE });
}
