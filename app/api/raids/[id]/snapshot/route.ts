import { NextResponse } from 'next/server';
import { loadSnapshot } from '@/lib/addon-snapshot';
import { snapshotLines } from '@/lib/addon-snapshot-text';
import { db } from '@/lib/db';
import { REASONS } from '@/lib/loot-rules';
import { requireLootOfficer } from '../../../_loot';
import { NO_STORE } from '../../../_officer';

/**
 * GET /api/raids/[id]/snapshot — the raid's reserve snapshot as pasted text (officers).
 * 200 `{ parts: string[] }`: one `BFSNAP1:n/N:…` line per part, all from one snapshot, so a
 * run of copies never mixes two moments. A cancelled raid answers 409; a missing one 404.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireLootOfficer();
  if ('deny' in auth) return auth.deny;
  const { id } = await params;
  const raid = await db.raid.findUnique({ where: { id }, select: { cancelledAt: true } });
  if (!raid) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  if (raid.cancelledAt) return NextResponse.json({ error: REASONS.cancelled }, { status: 409, headers: NO_STORE });
  const snapshot = await loadSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ parts: snapshotLines(snapshot) }, { headers: NO_STORE });
}
