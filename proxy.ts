import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { gateDecision, NOINDEX_HEADER } from '@/lib/auth/gate';
import { DEV_SESSION_COOKIE, devSessionFromCookie } from '@/lib/dev-session';
import type { Role } from '@/lib/session';

/**
 * Route gating for the member and officer areas. The rules are in lib/auth/gate.ts
 * (tested); this adapts them to Next's proxy. In development the dev-session cookie
 * stands in for a real session, as it does in getSession().
 */
export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  let role: Role | null = req.auth?.user?.role ?? null;
  const stub = devSessionFromCookie(req.cookies.get(DEV_SESSION_COOKIE)?.value);
  if (stub !== undefined) role = stub?.role ?? null;

  const decision = gateDecision(pathname, search, role);
  const response =
    decision.kind === 'redirect'
      ? NextResponse.redirect(new URL(decision.to, req.url))
      : decision.kind === 'notFound'
        ? NextResponse.rewrite(new URL('/__not-found', req.url), { status: 404 })
        : NextResponse.next();

  // Every response for these areas is noindex, the login redirect included.
  response.headers.set(NOINDEX_HEADER[0], NOINDEX_HEADER[1]);
  return response;
});

export const config = {
  matcher: ['/members/:path*', '/officers/:path*'],
};
