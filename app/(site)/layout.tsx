import type { ReactNode } from 'react';
import { Footer, SiteHeader } from '@/components/shell';
import { getSession } from '@/lib/session';

/** Header, content column, footer. Everything under (site) gets the shell; /dev does not. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader session={session} />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}
