import type { ReactNode } from 'react';
import { AnnouncementBar } from '@/components/shell/AnnouncementBar';
import { SiteShell } from '@/components/shell/SiteShell';
import { getSession } from '@/lib/session';

/** The home page is the shell plus the announcement bar above the header (docs/04 § Home). */
export default async function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell session={await getSession()} above={<AnnouncementBar />}>
      {children}
    </SiteShell>
  );
}
