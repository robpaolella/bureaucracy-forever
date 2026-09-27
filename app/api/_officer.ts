import { NextResponse } from 'next/server';
import { getSession, type Session } from '@/lib/session';

export const NO_STORE = { 'Cache-Control': 'private, no-store' };

/** The officer's session, or the 401/403 to send back. */
export async function requireOfficer(): Promise<{ session: Session } | { deny: NextResponse }> {
  const session = await getSession();
  if (!session) return { deny: NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE }) };
  if (session.role !== 'officer') return { deny: NextResponse.json({ error: 'Officers only.' }, { status: 403, headers: NO_STORE }) };
  return { session };
}

export async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
