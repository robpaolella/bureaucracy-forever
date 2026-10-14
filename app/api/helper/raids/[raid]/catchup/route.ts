import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardHelperRequest, HELPER_NO_STORE, helperError } from '@/lib/helper-api';
import { loadCatchup } from '@/lib/helper-catchup';
import { REASONS } from '@/lib/loot-rules';

const unknownRaid = () => helperError(404, 'unknown-raid', 'This site has no such raid. It may be from the other site.');

/**
 * GET /api/helper/raids/[raid]/catchup — the raid's awards and pending voids as the site holds
 * them now (ADDON-SPEC 7.1, tree of 3.4). Unknown and cancelled raids answer as the snapshot does.
 */
export async function GET(request: Request, { params }: { params: Promise<{ raid: string }> }) {
  const caller = await guardHelperRequest(request);
  if ('deny' in caller) return caller.deny;
  const { raid: id } = await params;
  const raid = await db.raid.findUnique({ where: { id }, select: { cancelledAt: true } });
  if (!raid) return unknownRaid();
  if (raid.cancelledAt) return helperError(409, 'raid-cancelled', REASONS.cancelled);
  const catchup = await loadCatchup(id);
  if (!catchup) return unknownRaid();
  return NextResponse.json(catchup, { headers: HELPER_NO_STORE });
}
