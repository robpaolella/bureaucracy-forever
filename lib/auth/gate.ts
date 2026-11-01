import type { Role } from '@/lib/session';

/**
 * The routing decision for the member and officer areas (docs/03 § Routes and § Roles).
 * Pure, so proxy.ts stays a thin adapter and the rules are unit-tested.
 *
 *   a loot route while LOOT_ENABLED is off  → 404, logged in or not
 *   logged out                              → redirect to /login?back=<path>
 *   /officers without officer role          → 404 (not 403: do not confirm the route exists)
 *   /members as social                      → 404 (the Members area is for Guild Members only)
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

/**
 * The whole Members area needs at least `member` (Robert, 2026-10-31: guests, applicants and
 * former members get none of it). Each member page and route still checks the role itself,
 * as a percent-encoded path can slip past this regex too.
 */
const MEMBER_ONLY = /^\/members(\/|$)/;

/**
 * SYNC-SPEC §2: the bot's bearer secret is honoured only under /api/bot. Officers' helper keys
 * go to /api/helper, whose guard (lib/helper-api.ts) accepts nothing but a live `bfh_` key and
 * answers anything else with its own 401. A bearer header anywhere else is refused outright
 * so a secret can never be replayed against a route that was not written for it.
 */
export function rejectsBearer(pathname: string, authorization: string | null): boolean {
  if (!authorization || !/^Bearer\s/i.test(authorization)) return false;
  return !/^\/api\/(bot|helper)(\/|$)/.test(pathname);
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
  if (role === 'social' && MEMBER_ONLY.test(pathname)) return { kind: 'notFound' };
  return { kind: 'next' };
}

/**
 * Where a fresh login lands: the page it set out for, unless the gate would answer it with a
 * 404 for this role (a social sent to log in from a Members page). Then home instead.
 */
export function landingAfterLogin(back: URL, role: Role, flags: { loot: boolean } = { loot: false }): string {
  if (back.pathname === '/login') return '/';
  return gateDecision(back.pathname, back.search, role, flags).kind === 'notFound' ? '/' : back.pathname + back.search;
}
