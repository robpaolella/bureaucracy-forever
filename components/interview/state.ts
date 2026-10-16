import type { InterviewStatus } from '@/lib/generated/prisma/client';
import { formatLongDate } from '@/lib/time';

/**
 * What the applicant's page may know about their own interview: no officer ids, thread or
 * message ids. The loader (lib/apply-gate.ts) builds it from the session's own account.
 */
export type ApplicantInterview = {
  status: InterviewStatus;
  /** Half-hour starts the applicant sent, ISO. */
  slots: string[];
  proposedStart: string | null;
  bookedStart: string | null;
};

export type InterviewGate = { kind: 'signin' } | { kind: 'nothing' } | { kind: 'interview'; interview: ApplicantInterview };

const HALF_HOUR = 30 * 60_000;
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

/** A run of consecutive half-hour starts: from the first start to 30 minutes after the last. */
export type TimeRun = { start: string; minutes: number };

/**
 * Sent starts as the viewer reads them: runs of consecutive half-hours, grouped by the
 * viewer's calendar day ("Thursday 15 Oct"), a run splitting where that day changes.
 */
export function timesByDay(slots: string[], zone: string): { day: string; runs: TimeRun[] }[] {
  const days: { day: string; runs: { start: number; end: number }[] }[] = [];
  for (const t of [...new Set(slots.map((s) => Date.parse(s)))].sort((a, b) => a - b)) {
    const day = formatLongDate(new Date(t), zone);
    const current = days.at(-1);
    const last = current?.runs.at(-1);
    if (current?.day === day && last?.end === t) last.end = t + HALF_HOUR;
    else if (current?.day === day) current.runs.push({ start: t, end: t + HALF_HOUR });
    else days.push({ day, runs: [{ start: t, end: t + HALF_HOUR }] });
  }
  return days.map(({ day, runs }) => ({ day, runs: runs.map((r) => ({ start: new Date(r.start).toISOString(), minutes: (r.end - r.start) / 60_000 })) }));
}

/** Hours picked: an hour counts once whichever of its half-hour starts were sent (guild hours are whole UTC hours). */
export function countHours(slots: string[]): number {
  return new Set(slots.map((s) => Math.floor(Date.parse(s) / HOUR))).size;
}

/** "today", "tomorrow", "in 3 days"; null once the time is more than half a day past. */
export function relativeDays(start: string, now: Date): string | null {
  const days = Math.round((Date.parse(start) - now.getTime()) / DAY);
  if (days < 0) return null;
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}
