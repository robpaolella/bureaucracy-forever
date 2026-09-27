import { after, NextResponse } from 'next/server';
import { enqueue } from '@/lib/outbox';
import { decideRespond, type Existing } from '@/lib/signup-rules';
import { db } from '@/lib/db';
import type { Role } from '@/lib/design/class-colors';
import { countAccepted, isRaidResponse, type RaidResponse } from '@/lib/raids';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const RESPONSE_ENUM = { accept: 'ACCEPT', tentative: 'TENTATIVE', absent: 'ABSENT' } as const;

/**
 * PUT /api/raids/[id]/signup — the viewer's own answer to a raid (docs/06 § API routes).
 * Body `{ response: "accept" | "tentative" | "absent" | null, reason? }`; null withdraws
 * the answer, which is what Undo sends when there was none before. Writes carry
 * `source: WEB`; the last write wins on updatedAt (docs/06 § Discord bot sync). Members
 * only: socials do not sign up (docs/03 § Roles). Officers may pass `forUserId` to answer
 * on a member's behalf (docs/04 § Raid detail); that write records `setBy`. Returns the
 * answered user's id and response with the raid's accepted counts.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role === 'social') return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === 'object' ? (body as { response?: unknown; reason?: unknown; forUserId?: unknown }) : {};
  if (b.response !== null && !isRaidResponse(b.response)) {
    return NextResponse.json({ error: 'response must be "accept", "tentative", "absent" or null.' }, { status: 400, headers: NO_STORE });
  }
  const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 200) : null;
  const forUserId = typeof b.forUserId === 'string' && b.forUserId ? b.forUserId : null;
  if (forUserId && session.role !== 'officer') {
    return NextResponse.json({ error: 'Only officers answer on someone else’s behalf.' }, { status: 403, headers: NO_STORE });
  }

  const raid = await db.raid.findUnique({ where: { id }, select: { id: true, cancelledAt: true, startsAt: true, durationMin: true, discordThreadId: true, status: true, locksAt: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: 'This raid was cancelled.' }, { status: 409, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 < Date.now()) {
    return NextResponse.json({ error: 'This raid has already happened.' }, { status: 409, headers: NO_STORE });
  }

  // JWT sessions do not create a User row; the first write does (same as availability).
  const user = await db.user.upsert({
    where: { discordId: session.discordId },
    create: { discordId: session.discordId, discordName: session.name, role: session.role.toUpperCase() as 'MEMBER' | 'OFFICER' },
    update: { discordName: session.name, role: session.role.toUpperCase() as 'MEMBER' | 'OFFICER' },
    select: { id: true },
  });

  // An officer answering for someone else: the target must exist, and the row records who set it.
  let targetId = user.id;
  let setByUserId: string | null = null;
  if (forUserId && forUserId !== user.id) {
    const target = await db.user.findUnique({ where: { id: forUserId }, select: { id: true, role: true } });
    if (!target) return NextResponse.json({ error: 'No such member.' }, { status: 404, headers: NO_STORE });
    if (target.role === 'SOCIAL') return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });
    targetId = target.id;
    setByUserId = user.id;
  }

  const response = b.response as RaidResponse | null;
  const existingRow = await db.signup.findUnique({ where: { raidId_userId: { raidId: raid.id, userId: targetId } }, select: { standing: true, response: true } });
  const existing: Existing = existingRow ? { standing: existingRow.standing, response: (existingRow.response?.toLowerCase() as RaidResponse | undefined) ?? null } : null;
  if (response === null) {
    // Withdrawing: a roster member goes back to unanswered; a bench row goes away.
    if (existing?.standing === 'ROSTER') await db.signup.update({ where: { raidId_userId: { raidId: raid.id, userId: targetId } }, data: { response: null, reason: null, setByUserId, source: 'WEB' } });
    else await db.signup.deleteMany({ where: { raidId: raid.id, userId: targetId } });
  } else {
    // SYNC-SPEC §7: roster members answer; others land on the bench; an officer answering
    // for someone is the one write the lock does not stop.
    const outcome = decideRespond({ role: setByUserId ? 'officer' : session.role }, raid, existing, response, new Date(), setByUserId !== null);
    if (!outcome.ok) return NextResponse.json({ error: outcome.reason }, { status: outcome.status, headers: NO_STORE });
    const fields = { standing: outcome.standing, response: RESPONSE_ENUM[outcome.response], source: 'WEB' as const, reason: outcome.response === 'absent' ? reason : null, setByUserId };
    await db.signup.upsert({
      where: { raidId_userId: { raidId: raid.id, userId: targetId } },
      create: { raidId: raid.id, userId: targetId, ...fields },
      update: fields,
    });
  }

  const signups = await db.signup.findMany({
    where: { raidId: raid.id },
    select: { response: true, user: { select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } },
  });
  const counts = countAccepted(
    signups.map((s) => ({ response: (s.response?.toLowerCase() as RaidResponse | undefined) ?? null, role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null })),
  );
  if (raid.discordThreadId) after(() => enqueue('raid.update', { raidId: raid.id }));
  return NextResponse.json({ raidId: raid.id, userId: targetId, response, counts }, { headers: NO_STORE });
}
