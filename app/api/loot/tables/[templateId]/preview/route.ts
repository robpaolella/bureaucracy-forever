import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { allItemIds, parseIdsFile } from '@/lib/loot-import';
import { refreshItems } from '@/lib/loot-items';
import { itemSourceError, SOURCE_CONFLICT } from '@/lib/item-sources';
import { LOAD_TABLE_SELECT, mergePreview } from '@/lib/loot-load';
import { REFRESH_BATCH } from '@/lib/loot-table-rules';
import { requireLootOfficer } from '../../../../_loot';
import { jsonBody, NO_STORE } from '../../../../_officer';

export const maxDuration = 60;

/**
 * Body: { file: parsed JSON, source?: 'FOREVER' | 'CLASSIC', skip?: number[] }.
 * Repeat with the same file/source and returned skip until remaining is zero. Cached items
 * resume successful fetches; skip carries failures (all remain visible in notFound).
 * No table writes. The token fingerprints the table, not the file; apply must validate both.
 */
export async function POST(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return NextResponse.json({ error: 'Not found.' }, { status: 404, headers: NO_STORE });
  const started = Date.now();
  const body = (await jsonBody(request) ?? {}) as { file?: unknown; source?: unknown; skip?: unknown };
  const source = body.source ?? 'FOREVER';
  if (source !== 'FOREVER' && source !== 'CLASSIC') return NextResponse.json({ error: 'Pick Classic or Forever.' }, { status: 400, headers: NO_STORE });
  const policyError = itemSourceError(source);
  if (policyError) return NextResponse.json({ error: policyError }, { status: 400, headers: NO_STORE });
  let file;
  try { file = parseIdsFile(body.file); }
  catch (error) {
    return NextResponse.json({ error: `This file isn't a loot list: ${(error as Error).message}` }, { status: 400, headers: NO_STORE });
  }
  const { templateId } = await params;
  const state = await db.raidTemplate.findUnique({ where: { id: templateId }, select: LOAD_TABLE_SELECT });
  if (!state) return NextResponse.json({ error: 'No such raid tier.' }, { status: 404, headers: NO_STORE });
  const ids = allItemIds(file);
  const cached = await db.lootItem.findMany({ where: { id: { in: ids } }, select: { id: true, source: true } });
  if (cached.some((item) => item.source !== source)) return NextResponse.json({ error: SOURCE_CONFLICT }, { status: 400, headers: NO_STORE });
  const available = new Set(cached.map((item) => item.id));
  const skip = new Set<number>(Array.isArray(body.skip) ? body.skip.filter((id): id is number => Number.isSafeInteger(id) && ids.includes(id)) : []);
  const pending = ids.filter((id) => !available.has(id) && !skip.has(id));
  const result = await refreshItems(db, pending.slice(0, REFRESH_BATCH).map((id) => ({ id, source })), { deadline: started + 40_000 });
  result.saved.forEach((id) => available.add(id));
  result.failed.forEach(({ id }) => skip.add(id));
  const remaining = pending.length - result.saved.length - result.failed.length;
  return NextResponse.json({ remaining, skip: [...skip], failed: result.failed, preview: remaining ? null : mergePreview(state, file, available) }, { headers: NO_STORE });
}
