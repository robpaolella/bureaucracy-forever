import type { Role } from '@/lib/session';

/**
 * The routing decision for the member and officer areas (docs/03 § Routes). Pure, so
 * proxy.ts stays a thin adapter and the rules are unit-tested.
 *
 *   logged out                      → redirect to /login?back=<path>
 *   /officers without officer role  → 404 (not 403: do not confirm the route exists)
 *   otherwise                       → pass through
 *
 * Every response for these areas, including the redirect, is noindex.
 */
export type GateDecision =
  | { kind: 'redirect'; to: string }
  | { kind: 'notFound' }
  | { kind: 'next' };

export const NOINDEX_HEADER = ['X-Robots-Tag', 'noindex, nofollow'] as const;

export function isGatedPath(pathname: string): boolean {
  return /^\/(members|officers)(\/|$)/.test(pathname);
}

export function gateDecision(pathname: string, search: string, role: Role | null): GateDecision {
  if (!role) {
    const params = new URLSearchParams({ back: pathname + search });
    return { kind: 'redirect', to: `/login?${params.toString()}` };
  }
  if (/^\/officers(\/|$)/.test(pathname) && role !== 'officer') return { kind: 'notFound' };
  return { kind: 'next' };
}
