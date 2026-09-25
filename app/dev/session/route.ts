import { NextResponse, type NextRequest } from 'next/server';
import { DEV_SESSION_COOKIE, isDevSessionState } from '@/lib/dev-session';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * Dev-only session switcher: /dev/session?as=out|member|member-unsubmitted|officer&back=/
 * Sets the stub cookie and bounces back. Returns 404 in production.
 */
export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }
  const as = request.nextUrl.searchParams.get('as') ?? undefined;
  if (!isDevSessionState(as)) {
    return NextResponse.json({ error: 'as must be one of out, member, member-unsubmitted, officer' }, { status: 400 });
  }
  const response = NextResponse.redirect(safeRedirect(request.nextUrl.searchParams.get('back'), request.url, '/dev/shell'));
  response.cookies.set(DEV_SESSION_COOKIE, as, { path: '/', sameSite: 'lax', httpOnly: true });
  return response;
}
