'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { INTERVIEW } from '@/content/interview';
import { useSetAnswerState } from './AnswerState';
import { InterviewCard } from './InterviewCard';
import { InterviewPicker } from './InterviewPicker';
import { SentTimes } from './SentTimes';

const CHANGE_ID = 'interview-change-times';

type Props = { requestedAt: string; now: string; name: string; slots: string[]; changing?: boolean };

/**
 * The times an applicant sent, with "Change my times" reopening the picker on them (approved
 * design 367: submitted, changing). Update or Cancel closes it again. `changing` opens on the
 * picker (the dev page's changing state).
 */
export function SubmittedTimes({ requestedAt, now, name, slots, changing: initial = false }: Props) {
  const [changing, setChanging] = useState(initial);
  const setAnswerState = useSetAnswerState();
  const cancelled = useRef(false);
  // Cancel hands focus back to the button that opened the picker; a send moves it to the new title.
  useEffect(() => {
    if (changing || !cancelled.current) return;
    cancelled.current = false;
    document.getElementById(CHANGE_ID)?.focus();
  }, [changing]);
  const close = (wasCancelled: boolean) => {
    cancelled.current = wasCancelled;
    setChanging(false);
  };
  if (changing) return <InterviewPicker requestedAt={requestedAt} now={now} name={name} initial={slots} onClose={close} />;
  return (
    <InterviewCard
      title={INTERVIEW.submitted.title}
      extra={<SentTimes slots={slots} />}
      body={INTERVIEW.submitted.body}
      actions={
        <Button
          id={CHANGE_ID}
          variant="secondary"
          onClick={() => {
            // A notice from an earlier send is done with once the applicant changes again.
            setAnswerState({ stale: false, moved: false });
            setChanging(true);
          }}
        >
          {INTERVIEW.submitted.change}
        </Button>
      }
    />
  );
}
