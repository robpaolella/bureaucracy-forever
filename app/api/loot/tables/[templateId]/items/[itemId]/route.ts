import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { blockItem, setItemBlocked, unlockedHolders } from '@/lib/loot-blocks';
import { requireLootOfficer } from '../../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../../_officer';

type Params = { params: Promise<{ templateId: string; itemId: string }> };

/** The item id when it's on this tier's loot table, or the 404 to send back. */
async function tableItem({ params }: Params): Promise<{ templateId: string; id: number } | { deny: NextResponse }> {
  const { templateId, itemId } = await params;
  const id = Number(itemId);
  if (!Number.isSafeInteger(id)) return { deny: NextResponse.json({ error: 'No such item.' }, { status: 404, headers: NO_STORE }) };
  const entry = await db.lootTableEntry.findFirst({ where: { itemId: id, boss: { templateId } }, select: { itemId: true } });
  if (!entry) return { deny: NextResponse.json({ error: "That item isn't on this loot table." }, { status: 404, headers: NO_STORE }) };
  return { templateId, id };
}

/**
 * GET /api/loot/tables/[templateId]/items/[itemId] — `{ holders }`: who would lose a reserve if
 * the item were blocked now. The window reads it on opening, to tell a changed list apart.
 */
export async function GET(_request: Request, ctx: Params) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const item = await tableItem(ctx);
  if ('deny' in item) return item.deny;
  return NextResponse.json({ holders: await unlockedHolders(db, item.templateId, item.id, new Date()) }, { headers: NO_STORE });
}

/**
 * PUT /api/loot/tables/[templateId]/items/[itemId] — body `{ blocked, remove? }`: switch an item
 * off for reserves (or back on) across the whole tier, every boss that shows it. A block removes
 * the reserves on raids that haven't locked; `remove` lists the holder keys the officer confirmed
 * (none for a direct block). If the holders differ, it's refused with 409 and the current
 * `holders`, writing nothing.
 */
export async function PUT(request: Request, ctx: Params) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const body = (await jsonBody(request)) as { blocked?: unknown; remove?: unknown } | null;
  if (typeof body?.blocked !== 'boolean') return NextResponse.json({ error: 'Say whether the item is blocked.' }, { status: 400, headers: NO_STORE });
  const remove = body.remove ?? [];
  if (!Array.isArray(remove) || !remove.every((key) => typeof key === 'string')) return NextResponse.json({ error: 'List the reserves to remove.' }, { status: 400, headers: NO_STORE });
  const item = await tableItem(ctx);
  if ('deny' in item) return item.deny;

  if (!body.blocked) {
    await setItemBlocked(item.templateId, item.id, false);
    return NextResponse.json({ itemId: item.id, blocked: false }, { headers: NO_STORE });
  }
  const result = await blockItem(item.templateId, item.id, remove);
  if (!result.ok) return NextResponse.json({ error: 'The list changed. Check it and confirm again.', holders: result.holders }, { status: 409, headers: NO_STORE });
  return NextResponse.json({ itemId: item.id, blocked: true, removed: result.removed }, { headers: NO_STORE });
}
