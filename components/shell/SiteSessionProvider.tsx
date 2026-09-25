'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@/lib/session';

/**
 * The viewer's session for the header. Public pages must prerender (docs/03), so the
 * server never reads cookies for them: the provider starts logged out and asks
 * /api/session after hydration. Development passes the dev-stub session in directly.
 * Member and officer pages read getSession() on the server as usual.
 */
type Value = { session: Session | null; loading: boolean };

const Ctx = createContext<Value>({ session: null, loading: true });

export function SiteSessionProvider({ initial, children }: { initial: Session | null | undefined; children: ReactNode }) {
  const [value, setValue] = useState<Value>(() => ({ session: initial ?? null, loading: initial === undefined }));

  useEffect(() => {
    if (initial !== undefined) return;
    const controller = new AbortController();
    fetch('/api/session', { signal: controller.signal, credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<Session | null>) : null))
      .then((session) => setValue({ session, loading: false }))
      .catch(() => setValue({ session: null, loading: false }));
    return () => controller.abort();
  }, [initial]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSiteSession(): Value {
  return useContext(Ctx);
}
