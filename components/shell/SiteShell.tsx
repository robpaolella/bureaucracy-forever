import type { ReactNode } from 'react';
import type { Session } from '@/lib/session';
import { Footer } from './Footer';
import { SiteHeader } from './SiteHeader';

/** Header, content column, footer. `above` renders before the header (the home announcement). */
export function SiteShell({ session, above, children }: { session: Session | null; above?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {above}
      <SiteHeader session={session} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
