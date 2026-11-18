import { NextResponse } from 'next/server';
import { loadSnapshot } from '@/lib/addon-snapshot';
import { db } from '@/lib/db';
import { guardHelperRequest, HELPER_NO_STORE, helperError } from '@/lib/helper-api';
import { REASONS } from '@/lib/loot-rules';

const unknownRaid = () => helperError(404, 'unknown-raid', 'This site has no such raid. It may be from the other site.');

/**
 * GET /api/helper/raids/[raid]/snapshot — the raid's reserve snapshot as a JSON data tree
 * (ADDON-SPEC 7.1, fields of 3.1). A raid this site doesn't hold, including one from the other
 * site, is 404 `unknown-raid`; a cancelled one 409 `raid-cancelled`, as the Copy reserves bar.
 */
export async function GET(request: Request, { params }: { params: Promise<{ raid: string }> }) {
  const caller = await guardHelperRequest(request);
  if ('deny' in caller) return caller.deny;
  const { raid: id } = await params;
  const raid = await db.raid.findUnique({ where: { id }, select: { cancelledAt: true } });
  if (!raid) return unknownRaid();
  if (raid.cancelledAt) return helperError(409, 'raid-cancelled', REASONS.cancelled);
  const snapshot = await loadSnapshot(id);
  if (!snapshot) return unknownRaid();
  return NextResponse.json(snapshot, { headers: HELPER_NO_STORE });
}
