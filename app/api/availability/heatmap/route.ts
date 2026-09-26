import { NextResponse, type NextRequest } from 'next/server';
import { isValidTimeZone } from '@/lib/availability';
import { buildHeatmap } from '@/lib/heatmap';
import { getRosterAvailability } from '@/lib/roster-availability';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * GET /api/availability/heatmap?tz=<IANA zone> — the roster's availability stacked onto
 * one week in the requesting officer's zone (docs/06 § API routes). Officers only; the
 * roster read behind it is cached and expired on every availability write.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers only.' }, { status: 403, headers: NO_STORE });

  const tz = request.nextUrl.searchParams.get('tz');
  if (!isValidTimeZone(tz)) return NextResponse.json({ error: 'tz must be an IANA zone name.' }, { status: 400, headers: NO_STORE });

  const roster = await getRosterAvailability();
  return NextResponse.json(buildHeatmap(roster, tz), { headers: NO_STORE });
}
