'use client';

import { useEffect } from 'react';
import { StatusPage } from '@/components/site/StatusPage';
import { Button, ButtonLink } from '@/components/ui';
import { ERROR } from '@/content/errors';

/** Route-level error boundary for everything in the shell. Logs, offers a retry, keeps the header. */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage
      eyebrow={ERROR.eyebrow}
      title={ERROR.title}
      body={ERROR.body}
      actions={
        <>
          <Button onClick={reset}>{ERROR.retry}</Button>
          <ButtonLink href="/" variant="secondary">
            {ERROR.home}
          </ButtonLink>
        </>
      }
    />
  );
}
