import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { moveId, parseBossInput } from '@/lib/loot-table-rules';
import { isMissing, isUniqueViolation, requireLootOfficer } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

type Ctx = { params: Promise<{ bossId: string }> };

/** PATCH /api/loot/bosses/[bossId] — rename, toggle trash, or move one place up or down. */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseBossInput(await jsonBody(request), false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { bossId } = await params;
  const boss = await db.lootBoss.findUnique({ where: { id: bossId }, select: { templateId: true } });
  if (!boss) return NextResponse.json({ error: 'No such boss.' }, { status: 404, headers: NO_STORE });
  const { name, isTrash, move } = parsed.value;

  try {
    await db.$transaction(async (tx) => {
      if (name !== undefined || isTrash !== undefined) await tx.lootBoss.update({ where: { id: bossId }, data: { name, isTrash } });
      if (move) {
        const order = (await tx.lootBoss.findMany({ where: { templateId: boss.templateId }, orderBy: { position: 'asc' }, select: { id: true } })).map((b) => b.id);
        const next = moveId(order, bossId, move);
        // Renumber the whole tier: positions stay dense however they drifted.
        for (const [position, id] of next.entries()) await tx.lootBoss.update({ where: { id }, data: { position } });
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'This raid already has a boss with that name.' }, { status: 409, headers: NO_STORE });
    if (isMissing(e)) return NextResponse.json({ error: 'No such boss.' }, { status: 404, headers: NO_STORE });
    throw e;
  }
  return NextResponse.json({ id: bossId }, { headers: NO_STORE });
}

/**
 * DELETE /api/loot/bosses/[bossId] — remove a boss and its item list. Loot already awarded
 * from it keeps the boss's name (LootAward.bossName); reserves are per item and unaffected.
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const { bossId } = await params;
  try {
    await db.lootBoss.delete({ where: { id: bossId } });
  } catch (e) {
    if (isMissing(e)) return NextResponse.json({ error: 'No such boss.' }, { status: 404, headers: NO_STORE });
    throw e;
  }
  return NextResponse.json({ id: bossId, deleted: true }, { headers: NO_STORE });
}
