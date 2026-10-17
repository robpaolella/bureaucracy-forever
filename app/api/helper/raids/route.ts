import { NextResponse } from 'next/server';
import { guardHelperRequest, HELPER_NO_STORE, siteEnv } from '@/lib/helper-api';
import { listHelperRaids } from '@/lib/helper-raids';

/** GET /api/helper/raids — raids starting within 12 hours or under way, soonest first (ADDON-SPEC 7.5). */
export async function GET(request: Request) {
  const caller = await guardHelperRequest(request);
  if ('deny' in caller) return caller.deny;
  return NextResponse.json(await listHelperRaids(siteEnv()), { headers: HELPER_NO_STORE });
}
