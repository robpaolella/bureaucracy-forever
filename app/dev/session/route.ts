import { NextResponse, type NextRequest } from 'next/server';
import { DEV_SESSION_COOKIE, isDevSessionState } from '@/lib/session';

/** Only same-origin, path-absolute targets. Rejects `//host` and backslash tricks. */
function safeBack(raw: string | null, requestUrl: string): URL {
  const fallback = new URL('/dev/shell', requestUrl);
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  const target = new URL(raw, requestUrl);
  return target.origin === fallback.origin ? target : fallback;
}

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
  const response = NextResponse.redirect(safeBack(request.nextUrl.searchParams.get('back'), request.url));
  response.cookies.set(DEV_SESSION_COOKIE, as, { path: '/', sameSite: 'lax', httpOnly: true });
  return response;
}
