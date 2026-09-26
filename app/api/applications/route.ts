import { NextResponse } from 'next/server';
import { loadInbox } from '@/lib/applications-data';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** GET /api/applications — the inbox rows (officers; docs/06 § API routes). The public POST is the form's server action. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers read applications.' }, { status: 403, headers: NO_STORE });
  return NextResponse.json({ applications: await loadInbox() }, { headers: NO_STORE });
}
