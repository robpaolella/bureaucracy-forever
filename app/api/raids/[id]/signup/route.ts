import { NextResponse } from 'next/server';
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
 * only: socials do not sign up (docs/03 § Roles). Returns the raid's accepted counts.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role === 'social') return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === 'object' ? (body as { response?: unknown; reason?: unknown }) : {};
  if (b.response !== null && !isRaidResponse(b.response)) {
    return NextResponse.json({ error: 'response must be "accept", "tentative", "absent" or null.' }, { status: 400, headers: NO_STORE });
  }
  const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 200) : null;

  const raid = await db.raid.findUnique({ where: { id }, select: { id: true, cancelledAt: true, startsAt: true, durationMin: true } });
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

  const response = b.response as RaidResponse | null;
  if (response === null) {
    await db.signup.deleteMany({ where: { raidId: raid.id, userId: user.id } });
  } else {
    await db.signup.upsert({
      where: { raidId_userId: { raidId: raid.id, userId: user.id } },
      create: { raidId: raid.id, userId: user.id, response: RESPONSE_ENUM[response], source: 'WEB', reason: response === 'absent' ? reason : null },
      update: { response: RESPONSE_ENUM[response], source: 'WEB', reason: response === 'absent' ? reason : null, setByUserId: null },
    });
  }

  const signups = await db.signup.findMany({
    where: { raidId: raid.id },
    select: { response: true, user: { select: { characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } },
  });
  const counts = countAccepted(
    signups.map((s) => ({ response: s.response.toLowerCase() as RaidResponse, role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null })),
  );
  return NextResponse.json({ raidId: raid.id, mine: response, counts }, { headers: NO_STORE });
}
