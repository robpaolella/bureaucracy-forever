import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lockReserveTier } from '@/lib/loot-blocks';
import { refreshItems } from '@/lib/loot-items';
import { itemSourceError, SOURCE_CONFLICT } from '@/lib/item-sources';
import { parseItemInput } from '@/lib/loot-table-rules';
import { isUniqueViolation, requireLootOfficer } from '../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../_officer';

/**
 * POST /api/loot/bosses/[bossId]/items — add an item by id or Wowhead link, at the end of
 * the boss's list. An item not yet cached is fetched from Wowhead first: one request.
 */
export async function POST(request: Request, { params }: { params: Promise<{ bossId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const parsed = parseItemInput(await jsonBody(request));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  const { bossId } = await params;
  const boss = await db.lootBoss.findUnique({ where: { id: bossId }, select: { id: true, templateId: true } });
  if (!boss) return NextResponse.json({ error: 'No such boss.' }, { status: 404, headers: NO_STORE });
  const { id, source } = parsed.value;
  const policyError = itemSourceError(source);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400, headers: NO_STORE });

  const cached = await db.lootItem.findUnique({ where: { id }, select: { source: true } });
  if (cached && cached.source !== source) return NextResponse.json({ error: SOURCE_CONFLICT }, { status: 409, headers: NO_STORE });
  if (!cached) {
    const res = await refreshItems(db, [{ id, source }], { gapMs: 0 });
    if (res.failed.length > 0) return NextResponse.json({ error: `Wowhead: ${res.failed[0].error}` }, { status: 502, headers: NO_STORE });
  }

  try {
    await db.$transaction(async (tx) => {
      await lockReserveTier(tx, boss.templateId);
      const last = await tx.lootTableEntry.findFirst({ where: { bossId }, orderBy: { position: 'desc' }, select: { position: true } });
      await tx.lootTableEntry.create({ data: { bossId, itemId: id, position: (last?.position ?? -1) + 1 } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return NextResponse.json({ error: 'That item is already on this boss.' }, { status: 409, headers: NO_STORE });
    throw e;
  }
  const item = await db.lootItem.findUnique({ where: { id }, select: { id: true, name: true } });
  return NextResponse.json(item, { status: 201, headers: NO_STORE });
}
