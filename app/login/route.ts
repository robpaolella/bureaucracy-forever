import type { NextRequest } from 'next/server';
import { signIn } from '@/auth';
import { safeRedirect } from '@/lib/safe-redirect';

/**
 * "Log in with Discord" goes straight to Discord rather than an Auth.js provider page.
 * `back` is where to land afterwards; only same-origin paths are honoured.
 */
export async function GET(request: NextRequest) {
  const back = safeRedirect(request.nextUrl.searchParams.get('back'), request.url, '/');
  await signIn('discord', { redirectTo: back.pathname + back.search });
}
