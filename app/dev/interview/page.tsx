import SqueezeLayout from '@/app/(squeeze)/layout';
import { InterviewSkeleton } from '@/components/interview/InterviewSkeleton';
import { InterviewView } from '@/components/interview/InterviewView';
import type { ApplicantInterview, InterviewGate } from '@/components/interview/state';

/**
 * Every applicant interview state with the approved design's sample data (design/341), so
 * they can be compared without a database. Gated by app/dev/layout.tsx. ?state=<slug>.
 */
const NOW = new Date('2026-10-15T22:15:00Z');
const BOOKED = '2026-10-18T02:00:00.000Z';
const run = (from: string, hours: number) => Array.from({ length: hours * 2 }, (_, i) => new Date(Date.parse(from) + i * 30 * 60_000).toISOString());
const SENT = [...run('2026-10-16T02:00:00Z', 2), ...run('2026-10-17T17:00:00Z', 3), ...run('2026-10-20T01:00:00Z', 3), ...run('2026-10-21T04:00:00Z', 2)];
const interview = (status: ApplicantInterview['status'], extra: Partial<ApplicantInterview> = {}): InterviewGate => ({
  kind: 'interview',
  interview: { status, slots: SENT, proposedStart: null, bookedStart: null, ...extra },
});

const STATES: Record<string, InterviewGate> = {
  'signed-out': { kind: 'signin' },
  nothing: { kind: 'nothing' },
  pick: interview('AWAITING_TIMES', { slots: [] }),
  submitted: interview('TIMES_RECEIVED'),
  proposed: interview('PROPOSED', { proposedStart: BOOKED }),
  booked: interview('BOOKED', { bookedStart: BOOKED }),
  'ended-cancelled': interview('CANCELLED', { bookedStart: BOOKED }),
  'ended-cancelled-unbooked': interview('CANCELLED'),
  'ended-no-time': interview('NO_TIME'),
  'ended-closed': interview('CLOSED'),
  'ended-done': interview('DONE', { bookedStart: BOOKED }),
};

export default async function InterviewDevPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state = 'submitted' } = await searchParams;
  return <SqueezeLayout>{state === 'loading' ? <InterviewSkeleton /> : <InterviewView gate={STATES[state] ?? STATES.submitted} now={NOW} />}</SqueezeLayout>;
}
