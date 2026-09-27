import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { NO_STORE, requireOfficer } from '../../../_officer';

/** POST /api/raids/:id/remind — "Nudge in Discord" (SYNC-SPEC §9.5): mention everyone on the roster who has not answered. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOfficer();
  if ('deny' in auth) return auth.deny;
  const { id } = await params;
  const raid = await db.raid.findUnique({ where: { id }, select: { id: true, status: true, discordThreadId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.status !== 'SCHEDULED') return NextResponse.json({ error: 'Only an open raid can be nudged.' }, { status: 409, headers: NO_STORE });
  if (!raid.discordThreadId) return NextResponse.json({ error: 'This raid has no Discord post yet.' }, { status: 409, headers: NO_STORE });
  const unanswered = await db.signup.findMany({ where: { raidId: id, standing: 'ROSTER', response: null }, select: { user: { select: { discordId: true } } } });
  if (unanswered.length === 0) return NextResponse.json({ nudged: 0 }, { headers: NO_STORE });
  await enqueue('raid.remind', { raidId: id, hours: null, discordIds: unanswered.map((s) => s.user.discordId), manual: true });
  return NextResponse.json({ nudged: unanswered.length }, { headers: NO_STORE });
}
