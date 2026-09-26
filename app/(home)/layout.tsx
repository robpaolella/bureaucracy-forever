import type { ReactNode } from 'react';
import { AnnouncementBar } from '@/components/shell/AnnouncementBar';
import { SiteShell } from '@/components/shell/SiteShell';

/** The home page is the shell plus the announcement bar above the header (docs/04 § Home). */
export default function HomeLayout({ children }: { children: ReactNode }) {
  return (
    <SiteShell initialSession={undefined} above={<AnnouncementBar />}>
      {children}
    </SiteShell>
  );
}
