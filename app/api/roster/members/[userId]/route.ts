import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Rank } from '@/lib/generated/prisma/enums';
import { RANKS } from '@/lib/roster-edit';
import { setRankFromWeb } from '@/lib/roles-sync';
import { jsonBody, NO_STORE, requireOfficer } from '../../../_officer';

/**
 * PATCH /api/roster/members/[userId] — `{ rank }` for a member with or without a main
 * (officers). The Discord Raider / Trial / Social roles follow (SYNC-SPEC §3). Officer rank
 * comes from the Discord Officer role and cannot be set here.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const { userId } = await params;
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const rank = body?.rank;
  if (typeof rank !== 'string' || !(RANKS as readonly string[]).includes(rank) || rank === 'officer') {
    return NextResponse.json({ error: 'Rank must be raider, trial or social.' }, { status: 400, headers: NO_STORE });
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, rank: true, discordName: true } });
  if (!user) return NextResponse.json({ error: 'No such member.' }, { status: 404, headers: NO_STORE });
  if (user.rank === 'OFFICER') return NextResponse.json({ error: 'Officers are set by the Discord Officer role.' }, { status: 409, headers: NO_STORE });
  await setRankFromWeb(user.id, rank.toUpperCase() as Rank);
  return NextResponse.json({ userId: user.id, rank }, { headers: NO_STORE });
}
