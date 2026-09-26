import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseRequirements } from '@/lib/raids';
import { NO_STORE, verifyBotGet } from '../_auth';

/**
 * GET /api/bot/raids — upcoming raids for the bot to post or refresh, with the Discord
 * event id it has already attached, if any. Signed like the POSTs, over an empty body.
 */
export async function GET(request: Request) {
  const denied = verifyBotGet(request);
  if (denied) return denied;
  const raids = await db.raid.findMany({
    where: { startsAt: { gte: new Date(Date.now() - 6 * 3600_000) } },
    orderBy: { startsAt: 'asc' },
    select: { id: true, name: true, startsAt: true, durationMin: true, notes: true, cancelledAt: true, discordEventId: true, requirements: true },
  });
  return NextResponse.json(
    {
      raids: raids.map((r) => ({
        id: r.id,
        name: r.name,
        startsAt: r.startsAt.toISOString(),
        durationMin: r.durationMin,
        notes: r.notes,
        cancelled: r.cancelledAt !== null,
        discordEventId: r.discordEventId,
        requirements: parseRequirements(r.requirements),
      })),
    },
    { headers: NO_STORE },
  );
}
