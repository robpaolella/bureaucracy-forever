import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { DEV_SESSION_COOKIE, devSessionFromCookie } from '@/lib/dev-session';
import type { Role } from '@/lib/session';

/**
 * Route gating for the member and officer areas (docs/03): logged out → Discord login;
 * /officers without officer role → 404, not 403, so the route is not confirmed to exist.
 * Both areas are noindex. Everything else is untouched. In development the dev-session
 * cookie stands in for a real session, as it does in getSession().
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const officersArea = pathname.startsWith('/officers');

  let role: Role | null = req.auth?.user?.role ?? null;
  const stub = devSessionFromCookie(req.cookies.get(DEV_SESSION_COOKIE)?.value);
  if (stub !== undefined) role = stub?.role ?? null;

  if (!role) {
    const login = new URL('/login', req.url);
    login.searchParams.set('back', pathname + search);
    return NextResponse.redirect(login);
  }

  const response =
    officersArea && role !== 'officer'
      ? NextResponse.rewrite(new URL('/__not-found', req.url), { status: 404 })
      : NextResponse.next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});

export const config = {
  matcher: ['/members/:path*', '/officers/:path*'],
};
