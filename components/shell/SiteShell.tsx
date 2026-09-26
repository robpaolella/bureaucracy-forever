import type { ReactNode } from 'react';
import type { Session } from '@/lib/session';
import { Footer } from './Footer';
import { SiteHeader } from './SiteHeader';
import { SiteSessionProvider } from './SiteSessionProvider';

/**
 * Header, content column, footer. `above` renders before the header (the home
 * announcement). Layouts pass `initialSession={undefined}` so they stay static and the
 * header fetches its state from /api/session after load; a known value is only for tests.
 */
export function SiteShell({
  initialSession,
  above,
  children,
}: {
  initialSession: Session | null | undefined;
  above?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SiteSessionProvider initial={initialSession}>
      <div className="flex min-h-screen flex-col">
        {above}
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </div>
    </SiteSessionProvider>
  );
}
