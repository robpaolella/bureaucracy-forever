import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { jsonBody, NO_STORE, requireOfficer } from '../../../../_officer';

/** PATCH /api/raids/:id/signups/:userId — `{ standing: ROSTER|BENCH }`: officers move members between bench and roster before DONE (SYNC-SPEC §7). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const { id, userId } = await params;
  const body = (await jsonBody(request)) as Record<string, unknown> | null;
  const standing = body?.standing === 'BENCH' ? 'BENCH' : body?.standing === 'ROSTER' ? 'ROSTER' : null;
  if (!standing) return NextResponse.json({ error: 'standing must be ROSTER or BENCH.' }, { status: 400, headers: NO_STORE });
  const raid = await db.raid.findUnique({ where: { id }, select: { status: true, discordThreadId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.status === 'DONE' || raid.status === 'CANCELLED') return NextResponse.json({ error: 'This raid is over.' }, { status: 409, headers: NO_STORE });
  const moved = await db.signup.updateMany({ where: { raidId: id, userId }, data: { standing } });
  if (moved.count === 0) return NextResponse.json({ error: 'That member has no row on this raid.' }, { status: 404, headers: NO_STORE });
  if (raid.discordThreadId) await enqueue('raid.update', { raidId: id });
  return NextResponse.json({ raidId: id, userId, standing }, { headers: NO_STORE });
}
