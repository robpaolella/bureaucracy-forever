import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireLootOfficer } from '../../../../../_loot';
import { NO_STORE } from '../../../../../_officer';

/**
 * DELETE /api/loot/bosses/[bossId]/items/[itemId] — take an item off a boss. The cached
 * item, its reserves and its awards stay; reserves only offer items still in the table.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ bossId: string; itemId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const { bossId, itemId } = await params;
  const id = Number(itemId);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ error: 'No such item.' }, { status: 404, headers: NO_STORE });
  const gone = await db.lootTableEntry.deleteMany({ where: { bossId, itemId: id } });
  if (gone.count === 0) return NextResponse.json({ error: 'That item is not on this boss.' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ bossId, itemId: id, deleted: true }, { headers: NO_STORE });
}
