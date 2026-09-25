import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

/** The viewer's site session, for the client-side header. Never cached. */
export async function GET() {
  const session = await getSession();
  return NextResponse.json(session, { headers: { 'Cache-Control': 'private, no-store' } });
}
