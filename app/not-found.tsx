import type { Metadata } from 'next';
import { SiteShell } from '@/components/shell/SiteShell';
import { StatusPage } from '@/components/site/StatusPage';
import { ButtonLink } from '@/components/ui';
import { LOGIN_URL } from '@/lib/config';
import { NOT_FOUND } from '@/content/errors';

export const metadata: Metadata = { title: 'Not found', robots: { index: false, follow: false } };

/** The root not-found page also answers the member and officer gates, which 404 rather than confirm a route exists (docs/03). */
export default function NotFound() {
  return (
    <SiteShell initialSession={undefined}>
      <StatusPage
        eyebrow={NOT_FOUND.eyebrow}
        title={NOT_FOUND.title}
        body={NOT_FOUND.body}
        actions={
          <>
            <ButtonLink href="/">{NOT_FOUND.home}</ButtonLink>
            <ButtonLink href={LOGIN_URL} variant="secondary">
              {NOT_FOUND.login}
            </ButtonLink>
          </>
        }
      />
    </SiteShell>
  );
}
