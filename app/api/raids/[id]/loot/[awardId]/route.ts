import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decideVoid } from '@/lib/loot-rules';
import { ensureUser } from '@/lib/users';
import { requireLootOfficer } from '../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../_officer';

/**
 * PATCH /api/raids/[id]/loot/[awardId] — void a loot record (officers). Body `{ reason? }`.
 * Records are never deleted; a correction voids the wrong one and records the right one.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; awardId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const body = ((await jsonBody(request)) ?? {}) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : '';

  const { id: raidId, awardId } = await params;
  const award = await db.lootAward.findFirst({ where: { id: awardId, raidId }, select: { voidedAt: true } });
  if (!award) return NextResponse.json({ error: 'No such loot record.' }, { status: 404, headers: NO_STORE });
  const decision = decideVoid(award);
  if (!decision.ok) return NextResponse.json({ error: decision.reason }, { status: decision.status, headers: NO_STORE });

  const officer = await ensureUser(auth.session);
  // voidedAt: null in the where clause, so two officers voiding at once cannot both win.
  const done = await db.lootAward.updateMany({ where: { id: awardId, voidedAt: null }, data: { voidedAt: new Date(), voidedById: officer.id, voidReason: reason || null } });
  if (done.count === 0) return NextResponse.json({ error: 'That record is already void.' }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ id: awardId, voided: true }, { headers: NO_STORE });
}
