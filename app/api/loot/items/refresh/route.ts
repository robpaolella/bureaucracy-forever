import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refreshItems } from '@/lib/loot-items';
import { REFRESH_BATCH } from '@/lib/loot-table-rules';
import { requireLootOfficer } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

/** Up to REFRESH_BATCH items at ~1 request a second: well inside the function time limit. */
export const maxDuration = 60;

/**
 * POST /api/loot/items/refresh — fetch items from Wowhead again. Body `{ itemId }` for one
 * item, or `{ templateId, round? }` for the next REFRESH_BATCH items in that raid tier's table
 * not fetched since `round` (the start of this refresh; the first call starts one). Answers
 * what was saved, what failed, how many are left, and the round to pass back for the rest.
 */
export async function POST(request: Request) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const body = ((await jsonBody(request)) ?? {}) as { itemId?: unknown; templateId?: unknown; round?: unknown };

  let targets: { id: number; source: 'CLASSIC' | 'FOREVER' }[];
  let pending = 0;
  let round: string | null = null;
  if (typeof body.itemId === 'number' && Number.isSafeInteger(body.itemId)) {
    const item = await db.lootItem.findUnique({ where: { id: body.itemId }, select: { id: true, source: true } });
    if (!item) return NextResponse.json({ error: 'No such item.' }, { status: 404, headers: NO_STORE });
    targets = [item];
  } else if (typeof body.templateId === 'string' && body.templateId) {
    const given = typeof body.round === 'string' ? new Date(body.round) : null;
    const since = given && !Number.isNaN(given.getTime()) ? given : new Date();
    round = since.toISOString();
    const items = await db.lootItem.findMany({
      where: { fetchedAt: { lt: since }, entries: { some: { boss: { templateId: body.templateId } } } },
      orderBy: { fetchedAt: 'asc' },
      select: { id: true, source: true },
    });
    pending = items.length;
    targets = items.slice(0, REFRESH_BATCH);
  } else {
    return NextResponse.json({ error: 'Name an item or a raid tier.' }, { status: 400, headers: NO_STORE });
  }

  const res = await refreshItems(db, targets);
  return NextResponse.json({ saved: res.saved.length, failed: res.failed, remaining: Math.max(0, pending - targets.length), round }, { headers: NO_STORE });
}
