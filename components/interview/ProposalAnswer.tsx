'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import { answerShownProposal } from '@/app/(squeeze)/apply/interview/actions';
import { Button, buttonClassName, Modal, Toast, type ToastData } from '@/components/ui';
import { INTERVIEW } from '@/content/interview';
import { ACTIONS_ROW } from './InterviewCard';
import { useSetStale } from './StaleNotice';

const { proposed: COPY } = INTERVIEW;
const SOON_ID = 'interview-too-soon';

/**
 * Accept or Decline on a proposed time (approved design 367): Decline confirms first. Either
 * answer refreshes the page into its new state. Accept is disabled once the time is under 15
 * minutes away, whether the page knew when it rendered (`tooSoon`) or the server says so.
 */
export function ProposalAnswer({ proposedStart, tooSoon: soonAtRender }: { proposedStart: string; tooSoon: boolean }) {
  const router = useRouter();
  const setStale = useSetStale();
  const [pending, startTransition] = useTransition();
  const [refusedSoon, setRefusedSoon] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const tooSoon = soonAtRender || refusedSoon;
  const dismiss = useCallback(() => setToast(null), []);

  const send = (answer: 'accept' | 'decline') =>
    startTransition(async () => {
      setToast(null);
      setStale(false);
      try {
        const outcome = await answerShownProposal(answer, proposedStart);
        if (outcome === 'too_soon') setRefusedSoon(true);
        if (outcome === 'stale') setStale(true);
        setConfirming(false);
        router.refresh();
      } catch {
        // The site couldn't be reached: nothing changed, so the buttons stay for another try.
        setConfirming(false);
        setToast({ tone: 'stop', title: COPY.offline.title, detail: COPY.offline.detail, action: { label: COPY.offline.retry, onClick: () => send(answer) } });
      }
    });

  return (
    <>
      {tooSoon && (
        <div role="alert" id={SOON_ID} className="w-full rounded-card border border-stop-line bg-stop-wash px-5 py-4 text-left text-sm text-stop">
          {COPY.tooSoon}
        </div>
      )}
      <div className={ACTIONS_ROW}>
        {tooSoon ? (
          <button type="button" aria-disabled="true" aria-describedby={SOON_ID} className={buttonClassName({ disabled: true })}>
            {COPY.accept}
          </button>
        ) : (
          <Button loading={pending && !confirming} disabled={pending} onClick={() => send('accept')}>
            {COPY.accept}
          </Button>
        )}
        <Button variant="secondary" disabled={pending} onClick={() => setConfirming(true)}>
          {COPY.decline}
        </Button>
      </div>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={COPY.confirm.title}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {COPY.confirm.keep}
            </Button>
            <Button variant="danger" loading={pending} onClick={() => send('decline')}>
              {COPY.confirm.decline}
            </Button>
          </>
        }
      >
        <p className="pb-2">{COPY.confirm.body}</p>
      </Modal>
      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}
