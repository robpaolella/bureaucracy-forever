'use client';

import { useEffect } from 'react';
import { InterviewCard } from '@/components/interview/InterviewCard';
import { Button, ButtonLink } from '@/components/ui';
import { ERROR } from '@/content/errors';

/** The error boundary for squeeze pages: the site's error copy, in the squeeze card. */
export default function SqueezeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <InterviewCard
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
