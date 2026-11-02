import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DIGEST_ORDER, DIGEST_SELECT, digestPayload, digestUsers } from '@/lib/interview-digest';
import { authorizeBot, NO_STORE } from '../../_lib';

/** GET /api/bot/interviews/upcoming — every BOOKED interview that starts after now, in the `interview.digest` item shape (SYNC-SPEC §4). */
export async function GET(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const rows = await db.interview.findMany({
    where: { status: 'BOOKED', bookedStart: { gt: new Date() } },
    orderBy: [...DIGEST_ORDER],
    select: DIGEST_SELECT,
  });
  const { interviews } = digestPayload('', rows, await digestUsers(db, rows));
  return NextResponse.json({ interviews }, { headers: NO_STORE });
}
