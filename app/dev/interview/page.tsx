import SqueezeLayout from '@/app/(squeeze)/layout';
import { InterviewSkeleton } from '@/components/interview/InterviewSkeleton';
import { InterviewView } from '@/components/interview/InterviewView';
import { pickerStarts } from '@/lib/interview-slots';
import type { ApplicantInterview, InterviewGate } from '@/components/interview/state';

/**
 * Every applicant interview state with the approved design's sample data (design/341), so
 * they can be compared without a database. Gated by app/dev/layout.tsx. ?state=<slug>.
 */
const NOW = new Date('2026-10-15T22:15:00Z');
const REQUESTED = '2026-10-15T22:10:00.000Z';
const BOOKED = '2026-10-18T02:00:00.000Z';
// The design's proposed time: Wednesday 21 Oct, 5:00 PM guild time.
const PROPOSED = '2026-10-22T00:00:00.000Z';
const run = (from: string, hours: number) => Array.from({ length: hours * 2 }, (_, i) => new Date(Date.parse(from) + i * 30 * 60_000).toISOString());
const SENT = [...run('2026-10-16T02:00:00Z', 2), ...run('2026-10-17T17:00:00Z', 3), ...run('2026-10-20T01:00:00Z', 3), ...run('2026-10-21T04:00:00Z', 2)];
// The picker's sample picks (design 367): guild wall times, widened to whole hours like its buttons.
const HOUR = 60 * 60_000;
const OFFERED = pickerStarts(new Date(REQUESTED), NOW).map((d) => d.getTime());
const guild = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour + 7, minute);
const picked = (...runs: number[][]) => OFFERED.filter((t) => runs.some((r) => r.some((p) => Math.floor(p / HOUR) === Math.floor(t / HOUR)))).map((t) => new Date(t).toISOString());
const span = (day: number, hour: number, minute: number, halves: number) => Array.from({ length: halves }, (_, i) => guild(day, hour, minute) + i * 30 * 60_000);
const MOST = OFFERED.filter((t) => ![18, 21].includes(new Date(t - 7 * HOUR).getUTCDate())).map((t) => new Date(t).toISOString());
const interview = (status: ApplicantInterview['status'], extra: Partial<ApplicantInterview> = {}): InterviewGate => ({
  kind: 'interview',
  interview: { status, requestedAt: REQUESTED, slots: SENT, proposedStart: null, bookedStart: null, ...extra },
  name: 'Quillfeather',
});

const STATES: Record<string, InterviewGate> = {
  'signed-out': { kind: 'signin' },
  nothing: { kind: 'nothing' },
  pick: interview('AWAITING_TIMES', { slots: [] }),
  'pick-short': interview('AWAITING_TIMES', { slots: picked(span(19, 10, 0, 8)) }),
  'pick-partial': interview('AWAITING_TIMES', { slots: picked(span(15, 19, 0, 4), span(17, 10, 0, 6), span(19, 18, 0, 6), span(20, 21, 30, 3)) }),
  'pick-max': interview('AWAITING_TIMES', { slots: MOST }),
  'pick-after-window': interview('AWAITING_TIMES', { slots: [], requestedAt: '2026-10-01T22:10:00.000Z' }),
  submitted: interview('TIMES_RECEIVED'),
  proposed: interview('PROPOSED', { proposedStart: PROPOSED }),
  'error-too-soon': interview('PROPOSED', { proposedStart: PROPOSED }),
  booked: interview('BOOKED', { bookedStart: BOOKED }),
  'error-stale': interview('BOOKED', { bookedStart: BOOKED }),
  'ended-cancelled': interview('CANCELLED', { bookedStart: BOOKED }),
  'ended-cancelled-unbooked': interview('CANCELLED'),
  'ended-no-time': interview('NO_TIME'),
  'ended-closed': interview('CLOSED'),
  'ended-done': interview('DONE', { bookedStart: BOOKED }),
};

export default async function InterviewDevPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const { state = 'submitted' } = await searchParams;
  // error-too-soon is the proposal seen 10 minutes before it starts.
  const now = state === 'error-too-soon' ? new Date(Date.parse(PROPOSED) - 10 * 60_000) : NOW;
  return <SqueezeLayout>{state === 'loading' ? <InterviewSkeleton /> : <InterviewView gate={STATES[state] ?? STATES.submitted} now={now} stale={state === 'error-stale'} />}</SqueezeLayout>;
}
