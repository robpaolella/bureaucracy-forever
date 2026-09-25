import type { ReactNode } from 'react';
import { SiteShell } from '@/components/shell/SiteShell';
import { getSession } from '@/lib/session';

/** Everything under (site) gets the shell; /dev does not; the home page has its own group. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  return <SiteShell session={await getSession()}>{children}</SiteShell>;
}
