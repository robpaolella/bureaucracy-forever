import { LocalTime } from '@/components/time/LocalTime';
import { ButtonLink } from '@/components/ui';
import { INTERVIEW } from '@/content/interview';
import { DISCORD_INVITE_URL, LOGIN_URL } from '@/lib/config';
import { MIN_NOTICE_MS } from '@/lib/interview-slots';
import { InterviewCard } from './InterviewCard';
import { InterviewPicker } from './InterviewPicker';
import { ProposalAnswer } from './ProposalAnswer';
import { SubmittedTimes } from './SubmittedTimes';
import { AnswerStateHost } from './AnswerState';
import { relativeDays, type InterviewGate } from './state';

const PAGE = '/apply/interview';

/** A proposed or booked time: its date and time large, and how far off it is (`relative` overrides). */
function TimeLine({ start, now, relative = relativeDays(start, now) }: { start: string; now: Date; relative?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-ink-900 px-6 py-4">
      <LocalTime startsAt={start} durationMin={0} date className="text-balance font-display text-[22px] font-medium leading-tight text-fg md:text-[26px]" />
      {relative && <span className="text-[13px] text-fg-3">{relative}</span>}
    </div>
  );
}

/** The dev page's states that need a click on the real page: the picker reopened on sent times, or a failed send. */
export type StartAs = 'changing' | 'offline';

/**
 * Every state of the applicant's interview page (approved designs 341 and 367). `stale` starts
 * with the "changed while the page was open" notice showing (the dev page's error-stale);
 * `start` opens as `StartAs` describes.
 */
export function InterviewView({ gate, now, stale, start }: { gate: InterviewGate; now: Date; stale?: boolean; start?: StartAs }) {
  return (
    <AnswerStateHost stale={stale}>
      <InterviewState gate={gate} now={now} start={start} />
    </AnswerStateHost>
  );
}

function InterviewState({ gate, now, start }: { gate: InterviewGate; now: Date; start?: StartAs }) {
  if (gate.kind === 'signin') {
    const { title, body, action } = INTERVIEW.signedOut;
    return <InterviewCard title={title} body={body} actions={<ButtonLink href={`${LOGIN_URL}?back=${encodeURIComponent(PAGE)}`}>{action}</ButtonLink>} />;
  }
  if (gate.kind === 'nothing') {
    const { title, body, action } = INTERVIEW.nothing;
    return (
      <InterviewCard
        title={title}
        body={body}
        actions={
          <ButtonLink href="/" variant="secondary">
            {action}
          </ButtonLink>
        }
      />
    );
  }

  const { status, requestedAt, slots, proposedStart, bookedStart } = gate.interview;
  switch (status) {
    // Keyed by attempt, so a new attempt arriving on refresh starts a fresh picker.
    case 'AWAITING_TIMES':
      return <InterviewPicker key={requestedAt} requestedAt={requestedAt} now={now.toISOString()} name={gate.name} initial={slots} offline={start === 'offline'} />;
    case 'TIMES_RECEIVED':
      return <SubmittedTimes key={requestedAt} requestedAt={requestedAt} now={now.toISOString()} name={gate.name} slots={slots} changing={start === 'changing'} />;
    case 'PROPOSED': {
      if (!proposedStart) return <InterviewCard title={INTERVIEW.proposed.title} body={INTERVIEW.proposed.body} />;
      // Under 15 minutes away it can't be accepted (answerProposal), and the line counts minutes;
      // once started (until the tick lapses it) the line is left out rather than miscounted.
      const left = Date.parse(proposedStart) - now.getTime();
      const tooSoon = left < MIN_NOTICE_MS;
      return (
        <InterviewCard
          title={INTERVIEW.proposed.title}
          extra={<TimeLine start={proposedStart} now={now} relative={!tooSoon ? undefined : left > 0 ? INTERVIEW.proposed.startsIn(Math.ceil(left / 60_000)) : null} />}
          body={INTERVIEW.proposed.body}
          answer={<ProposalAnswer proposedStart={proposedStart} tooSoon={tooSoon} />}
        />
      );
    }
    case 'BOOKED':
      return (
        <InterviewCard
          title={INTERVIEW.booked.title}
          extra={bookedStart && <TimeLine start={bookedStart} now={now} />}
          body={INTERVIEW.booked.body}
          actions={<ButtonLink href={DISCORD_INVITE_URL}>{INTERVIEW.booked.action}</ButtonLink>}
        />
      );
    case 'CANCELLED': {
      const { title, before, after, noTime } = INTERVIEW.cancelled;
      const body = bookedStart ? (
        <>
          {before} <LocalTime startsAt={bookedStart} durationMin={0} date className="text-[15px]" /> {after}
        </>
      ) : (
        noTime
      );
      return <InterviewCard title={title} body={body} />;
    }
    case 'NO_TIME':
      return <InterviewCard title={INTERVIEW.noTime.title} body={INTERVIEW.noTime.body} />;
    case 'CLOSED':
      return <InterviewCard title={INTERVIEW.closed.title} body={INTERVIEW.closed.body} />;
    case 'DONE':
      return <InterviewCard title={INTERVIEW.done.title} body={INTERVIEW.done.body} />;
  }
}
