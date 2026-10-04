import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { refreshItems } from '@/lib/loot-items';
import { itemSourceError } from '@/lib/item-sources';
import { REFRESH_BATCH } from '@/lib/loot-table-rules';
import { requireLootOfficer } from '../../../_loot';
import { jsonBody, NO_STORE } from '../../../_officer';

export const maxDuration = 60;
/** No new Wowhead request starts after this, so a slow Wowhead cannot run past maxDuration. */
const BUDGET_MS = 40_000;

/**
 * POST /api/loot/items/refresh — fetch items from Wowhead again. Body `{ itemId }` for one
 * item, or `{ templateId, round?, skip? }` for the next REFRESH_BATCH items in that raid
 * tier's table not fetched since `round` (the start of this refresh; the first call starts
 * one) and not in `skip` (ids that already failed this round). Answers what was saved, what
 * failed, how many are left, and the round to pass back for the rest.
 */
export async function POST(request: Request) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const started = Date.now();
  const body = ((await jsonBody(request)) ?? {}) as { itemId?: unknown; templateId?: unknown; round?: unknown; skip?: unknown };

  if (typeof body.itemId === 'number' && Number.isSafeInteger(body.itemId)) {
    const item = await db.lootItem.findUnique({ where: { id: body.itemId }, select: { id: true, source: true } });
    if (!item) return NextResponse.json({ error: 'No such item.' }, { status: 404, headers: NO_STORE });
    const policyError = itemSourceError(item.source);
    if (policyError) return NextResponse.json({ error: policyError }, { status: 400, headers: NO_STORE });
    const res = await refreshItems(db, [item]);
    if (res.failed.length > 0) return NextResponse.json({ error: `Wowhead: ${res.failed[0].error}` }, { status: 502, headers: NO_STORE });
    return NextResponse.json({ saved: 1, failed: [], remaining: 0, round: null }, { headers: NO_STORE });
  }
  if (typeof body.templateId !== 'string' || !body.templateId) return NextResponse.json({ error: 'Name an item or a raid tier.' }, { status: 400, headers: NO_STORE });

  const given = typeof body.round === 'string' ? new Date(body.round) : null;
  const since = given && !Number.isNaN(given.getTime()) && given.getTime() <= started ? given : new Date(started);
  const skip = Array.isArray(body.skip) ? body.skip.filter((id): id is number => Number.isSafeInteger(id)).slice(0, 1000) : [];
  const pending = await db.lootItem.findMany({
    where: { fetchedAt: { lt: since }, id: { notIn: skip }, entries: { some: { boss: { templateId: body.templateId } } } },
    orderBy: [{ fetchedAt: 'asc' }, { id: 'asc' }],
    select: { id: true, source: true },
  });
  const res = await refreshItems(db, pending.slice(0, REFRESH_BATCH), { deadline: started + BUDGET_MS });
  const remaining = pending.length - res.saved.length - res.failed.length;
  return NextResponse.json({ saved: res.saved.length, failed: res.failed, remaining, round: since.toISOString() }, { headers: NO_STORE });
}
