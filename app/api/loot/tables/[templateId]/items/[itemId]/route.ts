import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { blockItem, itemWinLimit, setItemBlocked, setItemWinLimit, unlockedHolders } from '@/lib/loot-blocks';
import { parseWinLimit } from '@/lib/loot-rules';
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
 * GET /api/loot/tables/[templateId]/items/[itemId] — `{ holders, winLimit }`: who would lose a
 * reserve if the item were blocked now, and its win limit (1 for an item with no setting). The
 * window reads it on opening, to tell a changed list apart.
 */
export async function GET(_request: Request, ctx: Params) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const item = await tableItem(ctx);
  if ('deny' in item) return item.deny;
  const [holders, winLimit] = await Promise.all([unlockedHolders(db, item.templateId, item.id, new Date()), itemWinLimit(item.templateId, item.id)]);
  return NextResponse.json({ holders, winLimit }, { headers: NO_STORE });
}

/**
 * PUT /api/loot/tables/[templateId]/items/[itemId] — body `{ blocked, remove? }`: switch an item
 * off for reserves (or back on) across the whole tier, every boss that shows it. A block removes
 * the reserves on raids that haven't locked; `remove` lists the holder keys the officer confirmed
 * (none for a direct block). If the holders differ, it's refused with 409 and the current
 * `holders`, writing nothing.
 *
 * Or body `{ winLimit }`, on its own: how many HR/SR wins of the item one character may have
 * before it can't reserve it again, a whole number from 1 to 5. It keeps `blocked`, as blocking
 * and unblocking keep the limit, and removes no reserves.
 */
export async function PUT(request: Request, ctx: Params) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const raw = await jsonBody(request);
  const body = (raw && typeof raw === 'object' ? raw : {}) as { blocked?: unknown; remove?: unknown; winLimit?: unknown };
  if ('winLimit' in body) {
    if ('blocked' in body || 'remove' in body) return NextResponse.json({ error: 'Change one setting at a time.' }, { status: 400, headers: NO_STORE });
    const limit = parseWinLimit(body.winLimit);
    if (!limit.ok) return NextResponse.json({ error: limit.error }, { status: 400, headers: NO_STORE });
    const item = await tableItem(ctx);
    if ('deny' in item) return item.deny;
    await setItemWinLimit(item.templateId, item.id, limit.value);
    return NextResponse.json({ itemId: item.id, winLimit: limit.value }, { headers: NO_STORE });
  }
  if (typeof body.blocked !== 'boolean') return NextResponse.json({ error: 'Say whether the item is blocked, or give its win limit.' }, { status: 400, headers: NO_STORE });
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
