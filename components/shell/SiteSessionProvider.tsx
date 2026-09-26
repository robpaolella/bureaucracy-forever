'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@/lib/session';

/**
 * The viewer's session for the header. Public pages must prerender (docs/03), so the
 * server never reads cookies for them: the provider starts logged out and asks
 * /api/session after hydration, which returns the real Discord login when there is one
 * and the dev stub otherwise. Member and officer pages read getSession() on the server.
 */
const Ctx = createContext<Session | null>(null);

export function SiteSessionProvider({ initial, children }: { initial: Session | null | undefined; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(initial ?? null);

  useEffect(() => {
    if (initial !== undefined) return;
    const controller = new AbortController();
    fetch('/api/session', { signal: controller.signal, credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<Session | null>) : null))
      .then((s) => {
        if (!controller.signal.aborted) setSession(s);
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession(null);
      });
    return () => controller.abort();
  }, [initial]);

  return <Ctx.Provider value={session}>{children}</Ctx.Provider>;
}

export function useSiteSession(): { session: Session | null } {
  return { session: useContext(Ctx) };
}
