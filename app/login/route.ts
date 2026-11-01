import { NextResponse, type NextRequest } from 'next/server';
import { signIn } from '@/auth';
import { landingAfterLogin } from '@/lib/auth/gate';
import { lootEnabled } from '@/lib/flags';
import { getSession } from '@/lib/session';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * "Log in with Discord" goes straight to Discord rather than an Auth.js provider page.
 * `back` is where to land afterwards; only same-origin paths are honoured. Discord sends
 * the visitor back here, signed in, so the landing can depend on their role: a page the
 * gate would answer with a 404 (a social sent from a Members page) lands home instead.
 */
export async function GET(request: NextRequest) {
  const back = safeRedirect(request.nextUrl.searchParams.get('back'), request.url, '/');
  const session = await getSession();
  if (session) return NextResponse.redirect(new URL(landingAfterLogin(back, session.role, { loot: lootEnabled() }), request.url));
  await signIn('discord', { redirectTo: `/login?${new URLSearchParams({ back: back.pathname + back.search })}` });
}
