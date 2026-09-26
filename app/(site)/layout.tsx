import type { ReactNode } from 'react';
import { SiteShell } from '@/components/shell/SiteShell';

/**
 * Everything under (site) gets the shell; /dev does not; the home page has its own group.
 * No cookies are read here in production, so public pages prerender (docs/03).
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell initialSession={undefined}>{children}</SiteShell>;
}
