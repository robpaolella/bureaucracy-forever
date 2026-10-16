import { LocalTime } from '@/components/time/LocalTime';
import { ButtonLink } from '@/components/ui';
import { INTERVIEW } from '@/content/interview';
import { DISCORD_INVITE_URL, LOGIN_URL } from '@/lib/config';
import { InterviewCard } from './InterviewCard';
import { InterviewPicker } from './InterviewPicker';
import { SentTimes } from './SentTimes';
import { relativeDays, type InterviewGate } from './state';

const PAGE = '/apply/interview';

/** A proposed or booked time: its date and time large, and how far off it is. */
function TimeLine({ start, now }: { start: string; now: Date }) {
  const relative = relativeDays(start, now);
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-card border border-line bg-ink-900 px-6 py-4">
      <LocalTime startsAt={start} durationMin={0} date className="text-balance font-display text-[22px] font-medium leading-tight text-fg md:text-[26px]" />
      {relative && <span className="text-[13px] text-fg-3">{relative}</span>}
    </div>
  );
}

/**
 * Every state of the applicant's interview page (approved designs 341 and 367). Sending times
 * and answering a proposal arrive in later parts; until then the picker's Send does nothing and
 * a proposal shows its heading without actions.
 */
export function InterviewView({ gate, now }: { gate: InterviewGate; now: Date }) {
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
    case 'AWAITING_TIMES':
      return <InterviewPicker requestedAt={requestedAt} now={now.toISOString()} name={gate.name} initial={slots} />;
    case 'TIMES_RECEIVED':
      return <InterviewCard title={INTERVIEW.submitted.title} extra={<SentTimes slots={slots} />} body={INTERVIEW.submitted.body} />;
    case 'PROPOSED':
      return <InterviewCard title={INTERVIEW.proposed.title} extra={proposedStart && <TimeLine start={proposedStart} now={now} />} body={INTERVIEW.proposed.body} />;
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
