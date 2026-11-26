import { NextResponse } from 'next/server';
import { guardHelperRequest, HELPER_NO_STORE, helperError } from '@/lib/helper-api';
import { loadProblems } from '@/lib/helper-problems';

/**
 * GET /api/helper/raids/[raid]/problems — what the site rejected or is holding for the raid
 * (ADDON-SPEC 7.4). A cancelled raid still answers: its refused uploads are listed here.
 */
export async function GET(request: Request, { params }: { params: Promise<{ raid: string }> }) {
  const caller = await guardHelperRequest(request);
  if ('deny' in caller) return caller.deny;
  const { raid } = await params;
  const problems = await loadProblems(raid);
  if (!problems) return helperError(404, 'unknown-raid', 'This site has no such raid. It may be from the other site.');
  return NextResponse.json(problems, { headers: HELPER_NO_STORE });
}
