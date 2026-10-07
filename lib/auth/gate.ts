import type { Role } from '@/lib/session';

/**
 * The routing decision for the member and officer areas (docs/03 § Routes and § Roles).
 * Pure, so proxy.ts stays a thin adapter and the rules are unit-tested.
 *
 *   a loot route while LOOT_ENABLED is off  → 404, logged in or not
 *   logged out                              → redirect to /login?back=<path>
 *   /officers without officer role          → 404 (not 403: do not confirm the route exists)
 *   /members/availability as social         → 404 (socials get roster and calendar only)
 *   otherwise                               → pass through
 *
 * Every response for these areas, including the redirect, is noindex.
 */
export type GateDecision =
  | { kind: 'redirect'; to: string }
  | { kind: 'notFound' }
  | { kind: 'next' };

export const NOINDEX_HEADER = ['X-Robots-Tag', 'noindex, nofollow'] as const;

/**
 * Loot pages (lib/flags.ts lootEnabled): they do not exist while the flag is off. This gives
 * the real 404 status; each loot page and route still checks lootEnabled() itself, which is
 * the guard that counts (a percent-encoded path can slip past this regex).
 */
const LOOT_ROUTES = /^\/(members|officers)\/loot(\/|$)/;

/** Member-area routes that need at least `member`; everything else under /members admits socials. */
const MEMBER_ONLY = [/^\/members\/(availability|loot)(\/|$)/];

/**
 * SYNC-SPEC §2: the bot's bearer secret is honoured only under /api/bot. A bearer header
 * anywhere else is refused outright so the secret can never be replayed against a route
 * that was not written for it.
 */
export function rejectsBearer(pathname: string, authorization: string | null): boolean {
  if (!authorization || !/^Bearer\s/i.test(authorization)) return false;
  return !/^\/api\/bot(\/|$)/.test(pathname);
}

export function isGatedPath(pathname: string): boolean {
  return /^\/(members|officers)(\/|$)/.test(pathname);
}

export function gateDecision(pathname: string, search: string, role: Role | null, flags: { loot: boolean } = { loot: false }): GateDecision {
  if (!flags.loot && LOOT_ROUTES.test(pathname)) return { kind: 'notFound' };
  if (!role) {
    const params = new URLSearchParams({ back: pathname + search });
    return { kind: 'redirect', to: `/login?${params.toString()}` };
  }
  if (/^\/officers(\/|$)/.test(pathname) && role !== 'officer') return { kind: 'notFound' };
  if (role === 'social' && MEMBER_ONLY.some((re) => re.test(pathname))) return { kind: 'notFound' };
  return { kind: 'next' };
}
