import type { ReactNode } from 'react';
import type { Session } from '@/lib/session';
import { Footer } from './Footer';
import { SiteHeader } from './SiteHeader';
import { SiteSessionProvider } from './SiteSessionProvider';

/**
 * Header, content column, footer. `above` renders before the header (the home
 * announcement). `initialSession` is only ever the dev stub; in production it is
 * undefined so the layout stays static and the header fetches its state after load.
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
