import type { ReactNode } from 'react';
import { SiteShell } from '@/components/shell/SiteShell';
import { getDevStubSession } from '@/lib/session';

/**
 * Everything under (site) gets the shell; /dev does not; the home page has its own group.
 * No cookies are read here in production, so public pages prerender (docs/03).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell initialSession={await getDevStubSession()}>{children}</SiteShell>;
}
