import { NextResponse } from 'next/server';
import { enqueue } from '@/lib/outbox';
import { decideRespond, raidClosed } from '@/lib/signup-rules';
import { answerSignup, lockSignup } from '@/lib/character-switch';
import { db } from '@/lib/db';
import { characterBrought, MAIN_CHARACTER } from '@/lib/signup-character';
import type { Role } from '@/lib/design/class-colors';
import { countAccepted, isRaidResponse, type RaidResponse } from '@/lib/raids';
import { getSession } from '@/lib/session';
import { webReason } from '@/lib/signup-web-reason';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
const RESPONSE_ENUM = { accept: 'ACCEPT', tentative: 'TENTATIVE', absent: 'ABSENT' } as const;

/**
 * PUT /api/raids/[id]/signup — the viewer's own answer to a raid (docs/06 § API routes).
 * Body `{ response: "accept" | "tentative" | "absent" | null, reason?, characterId?, makeDefault?, keepCharacter? }`;
 * null withdraws the answer, which is what Undo sends when there was none before (Undo
 * restores the answer only, never the character or default). `characterId` (Accept or
 * Tentative only) is the character brought; without it a first Accept/Tentative brings
 * the member's default (lib/signup-rules.ts). `makeDefault: true` also saves it as the
 * member's default, never with `forUserId`. `keepCharacter: true` (what Undo sends with a
 * restored answer) changes the answer only and brings no character, so the default rule
 * never applies; it is refused with `characterId` or `makeDefault`. Writes carry
 * `source: WEB`; the last write wins on updatedAt (docs/06 § Discord bot sync). Members
 * only: socials do not sign up (docs/03 § Roles). Officers may pass `forUserId` to answer
 * on a member's behalf (docs/04 § Raid detail); that write records `setBy`. Returns the
 * answered user's id, response and brought character's id with the raid's accepted counts.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role === 'social') return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });

  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === 'object' ? (body as { response?: unknown; reason?: unknown; forUserId?: unknown; characterId?: unknown; makeDefault?: unknown; keepCharacter?: unknown }) : {};
  if (b.response !== null && !isRaidResponse(b.response)) {
    return NextResponse.json({ error: 'response must be "accept", "tentative", "absent" or null.' }, { status: 400, headers: NO_STORE });
  }
  if (b.characterId != null && (typeof b.characterId !== 'string' || !b.characterId.trim())) return NextResponse.json({ error: 'Pick a character.' }, { status: 400, headers: NO_STORE });
  const characterId = typeof b.characterId === 'string' ? b.characterId : null;
  if (characterId && (b.response === null || b.response === 'absent')) return NextResponse.json({ error: 'A character comes with Accept or Tentative only.' }, { status: 400, headers: NO_STORE });
  if (b.makeDefault !== undefined && typeof b.makeDefault !== 'boolean') return NextResponse.json({ error: 'makeDefault must be true or false.' }, { status: 400, headers: NO_STORE });
  const makeDefault = b.makeDefault === true;
  if (makeDefault && !characterId) return NextResponse.json({ error: 'Pick the character to sign up with every time.' }, { status: 400, headers: NO_STORE });
  if (makeDefault && b.forUserId != null) return NextResponse.json({ error: 'Only the member can set their own default character.' }, { status: 400, headers: NO_STORE });
  if (b.keepCharacter !== undefined && typeof b.keepCharacter !== 'boolean') return NextResponse.json({ error: 'keepCharacter must be true or false.' }, { status: 400, headers: NO_STORE });
  const keepCharacter = b.keepCharacter === true;
  if (b.keepCharacter !== undefined && (b.characterId != null || b.makeDefault !== undefined)) return NextResponse.json({ error: 'Keeping the character cannot come with choosing one.' }, { status: 400, headers: NO_STORE });
  const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 200) : null;
  const forUserId = typeof b.forUserId === 'string' && b.forUserId ? b.forUserId : null;
  if (forUserId && session.role !== 'officer') {
    return NextResponse.json({ error: 'Only officers answer on someone else’s behalf.' }, { status: 403, headers: NO_STORE });
  }

  const raid = await db.raid.findUnique({ where: { id }, select: { id: true, cancelledAt: true, startsAt: true, durationMin: true, discordThreadId: true, templateId: true, status: true, locksAt: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: 'This raid was cancelled.' }, { status: 409, headers: NO_STORE });
  if (raid.startsAt.getTime() + raid.durationMin * 60_000 < Date.now()) {
    return NextResponse.json({ error: 'This raid has already happened.' }, { status: 409, headers: NO_STORE });
  }

  // JWT sessions do not create a User row; the first write does (same as availability).
  const user = await db.user.upsert({
    where: { discordId: session.discordId },
    create: { discordId: session.discordId, discordName: session.name, role: session.role.toUpperCase() as 'MEMBER' | 'OFFICER' },
    // The name only on create: the bot's member snapshot keeps it current (lib/users.ts).
    update: { role: session.role.toUpperCase() as 'MEMBER' | 'OFFICER' },
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
  if (response === null) {
    // Withdrawing obeys the lock like any other answer (SYNC-SPEC §7); an officer acting
    // for someone is the exception. A roster member goes back to unanswered; a bench row goes away.
    const stop = raidClosed(raid, new Date(), setByUserId !== null);
    if (stop) return NextResponse.json({ error: webReason(stop.reason) }, { status: stop.status, headers: NO_STORE });
    await db.$transaction(async (tx) => {
      await lockSignup(tx, raid.id, targetId);
      const row = await tx.signup.findUnique({ where: { raidId_userId: { raidId: raid.id, userId: targetId } }, select: { standing: true } });
      if (row?.standing === 'ROSTER') await tx.signup.update({ where: { raidId_userId: { raidId: raid.id, userId: targetId } }, data: { response: null, reason: null, setByUserId, source: 'WEB' } });
      else await tx.signup.deleteMany({ where: { raidId: raid.id, userId: targetId } });
      if (raid.discordThreadId) await enqueue('raid.update', { raidId: raid.id }, tx);
    });
  } else {
    // SYNC-SPEC §7: roster members answer; others land on the bench; an officer answering
    // for someone is the one write the lock does not stop, and the switch to the
    // character it brings gets the same override.
    const actor = { role: setByUserId ? 'officer' as const : session.role };
    const result = await answerSignup({
      raid, userId: targetId, actor, officerOverride: setByUserId !== null, characterId, makeDefault, keepCharacter,
      notOwned: setByUserId
        ? 'That character is no longer available for this member. Choose another and try again.'
        : 'That character is no longer available. Choose another and try again.',
      decide: (existing) => decideRespond(actor, raid, existing, response, new Date(), setByUserId !== null),
      fields: (outcome) => ({ standing: outcome.standing, response: RESPONSE_ENUM[outcome.response], source: 'WEB', reason: outcome.response === 'absent' ? reason : null, setByUserId }),
    });
    if (!result.ok) return NextResponse.json({ error: webReason(result.reason) }, { status: result.status, headers: NO_STORE });
  }

  const signups = await db.signup.findMany({
    where: { raidId: raid.id },
    select: { userId: true, response: true, standing: true, character: { select: MAIN_CHARACTER.select }, user: { select: { characters: MAIN_CHARACTER } } },
  });
  // Composition counts roster acceptances only (SYNC-SPEC §7), the same as the cards.
  const counts = countAccepted(
    signups.filter((s) => s.standing === 'ROSTER').map((s) => ({ response: (s.response?.toLowerCase() as RaidResponse | undefined) ?? null, role: (characterBrought(s)?.raidRole.toLowerCase() as Role | undefined) ?? null })),
  );
  const own = signups.find((s) => s.userId === targetId);
  return NextResponse.json({ raidId: raid.id, userId: targetId, response, characterId: own ? characterBrought(own)?.id ?? null : null, counts }, { headers: NO_STORE });
}
