import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { lookupForeverItem, toItemView } from '@/lib/loot-items';
import { NOT_FOREVER, parseForeverItemRef, REASONS } from '@/lib/loot-rules';
import { requireLootOfficer } from '../../../../_loot';
import { NO_STORE } from '../../../../_officer';

/**
 * GET /api/raids/[id]/loot/lookup?item=<Wowhead Forever link or id> — what an unlisted drop
 * is, before recording it (officers). Saves nothing. Answers 200
 * `{ item: { id, name, quality, icon, tooltipHtml }, onTable: [{ bossId, bossName }] }`;
 * `onTable` lists this tier's bosses that already drop it, empty for an item new to the table.
 * An item on the table comes from the cache, without asking Wowhead. Failures answer
 * `{ error, code }` with `code` 'not-forever' (400), 'not-found' (404) or 'wowhead-down' (502).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const itemId = parseForeverItemRef(new URL(request.url).searchParams.get('item') ?? '');
  if (itemId === null) return NextResponse.json({ error: NOT_FOREVER, code: 'not-forever' }, { status: 400, headers: NO_STORE });

  const { id: raidId } = await params;
  const raid = await db.raid.findUnique({ where: { id: raidId }, select: { cancelledAt: true, templateId: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: REASONS.cancelled }, { status: 409, headers: NO_STORE });
  if (!raid.templateId) return NextResponse.json({ error: REASONS.noTable }, { status: 409, headers: NO_STORE });

  const entries = await db.lootTableEntry.findMany({
    where: { itemId, boss: { templateId: raid.templateId } },
    orderBy: { boss: { position: 'asc' } },
    select: { boss: { select: { id: true, name: true } }, item: { select: { id: true, name: true, quality: true, icon: true, tooltipHtml: true } } },
  });
  if (entries.length > 0) {
    const { item } = entries[0];
    return NextResponse.json({ item: toItemView(item), onTable: entries.map((e) => ({ bossId: e.boss.id, bossName: e.boss.name })) }, { headers: NO_STORE });
  }
  const found = await lookupForeverItem(db, itemId);
  if (!found.ok) return NextResponse.json({ error: found.error, code: found.code }, { status: found.status, headers: NO_STORE });
  return NextResponse.json({ item: found.item, onTable: [] }, { headers: NO_STORE });
}
