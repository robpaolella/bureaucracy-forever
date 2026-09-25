import { NextResponse, type NextRequest } from 'next/server';
import { DEV_SESSION_COOKIE, isDevSessionState } from '@/lib/session';

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
  const back = request.nextUrl.searchParams.get('back') ?? '/dev/shell';
  const response = NextResponse.redirect(new URL(back.startsWith('/') ? back : '/dev/shell', request.url));
  response.cookies.set(DEV_SESSION_COOKIE, as, { path: '/', sameSite: 'lax' });
  return response;
}
