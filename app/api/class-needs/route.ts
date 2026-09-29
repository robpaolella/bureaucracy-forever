import { NextResponse } from 'next/server';
import { parseNeedInput } from '@/lib/class-needs';
import { getClassNeeds, setClassNeed } from '@/lib/class-needs-data';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/class-needs — the grouped needs table, public (docs/06 § API routes). The bot reads /api/bot/needs instead. */
export async function GET() {
  return NextResponse.json({ needs: await getClassNeeds() }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}

/**
 * PUT /api/class-needs — set one spec's status (officers). Body `{ wowClass, spec, status }`.
 * Upserts the row and expires the needs cache so the recruitment page and the home teaser
 * follow; a spec that leaves high need loses its home-page star. The bot's /recruitment sets
 * needs the same way through PUT /api/bot/needs.
 */
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit class needs.' }, { status: 403, headers: NO_STORE });

  const parsed = parseNeedInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  await setClassNeed(parsed.value);
  const { wowClass, spec, status } = parsed.value;
  return NextResponse.json({ wowClass, spec, status }, { headers: NO_STORE });
}
