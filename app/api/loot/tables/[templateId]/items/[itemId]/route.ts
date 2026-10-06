import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setItemBlocked } from '@/lib/loot-blocks';
import { requireLootOfficer } from '../../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../../_officer';

/**
 * PUT /api/loot/tables/[templateId]/items/[itemId] — body `{ blocked }`: switch an item off
 * for reserves (or back on) across the whole tier, every boss that shows it. A block is
 * refused with 409 while anyone holds the item on a raid that hasn't locked (#135 adds the
 * confirmation that removes those reserves).
 */
export async function PUT(request: Request, { params }: { params: Promise<{ templateId: string; itemId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const body = (await jsonBody(request)) as { blocked?: unknown } | null;
  if (typeof body?.blocked !== 'boolean') return NextResponse.json({ error: 'Say whether the item is blocked.' }, { status: 400, headers: NO_STORE });
  const { templateId, itemId } = await params;
  const id = Number(itemId);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ error: 'No such item.' }, { status: 404, headers: NO_STORE });
  const entry = await db.lootTableEntry.findFirst({ where: { itemId: id, boss: { templateId } }, select: { itemId: true } });
  if (!entry) return NextResponse.json({ error: "That item isn't on this loot table." }, { status: 404, headers: NO_STORE });

  const result = await setItemBlocked(templateId, id, body.blocked);
  if (!result.ok) return NextResponse.json({ error: 'Someone holds a reserve on this item for a raid that has not locked.', holders: result.holders }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ itemId: id, blocked: body.blocked }, { headers: NO_STORE });
}
