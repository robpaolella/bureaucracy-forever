'use server';

import { answerProposal, applicantInterview, submitTimes } from '@/lib/interviews';
import { getSession } from '@/lib/session';

/** `stale`: the interview isn't the proposal the page showed any more; nothing was answered. */
export type AnswerOutcome = 'answered' | 'too_soon' | 'stale' | 'signin';

/**
 * The applicant accepts or declines the proposed time on their page. The applicant is the
 * session's account and the interview is theirs, found here: the page sends only the answer
 * and the proposed start it showed, so it can never name someone else's interview. A
 * different start (an officer re-proposed) or any other status answers nothing.
 */
export async function answerShownProposal(answer: 'accept' | 'decline', shownStart: string): Promise<AnswerOutcome> {
  const session = await getSession();
  if (!session) return 'signin';
  const view = await applicantInterview(session.discordId);
  if (view?.status !== 'PROPOSED' || view.proposedStart !== shownStart) return 'stale';
  const result = await answerProposal(view.id, session.discordId, answer);
  if (result.ok) return 'answered';
  return result.reason === 'too_soon' ? 'too_soon' : 'stale';
}

/** `refused`: the server turned the times down (the minimum or range); `error` says why in plain words. */
export type SendOutcome = { kind: 'sent' } | { kind: 'stale' } | { kind: 'signin' } | { kind: 'refused'; error: string };

/** What the page showed when the applicant picked: which attempt (by its request time) and the times then sent. */
export type ShownTimes = { requestedAt: string; slots: string[] };

const sameTimes = (a: string[], b: string[]) => {
  const x = new Set(a.map((s) => Date.parse(s)));
  const y = new Set(b.map((s) => Date.parse(s)));
  return x.size === y.size && [...x].every((t) => y.has(t));
};

/**
 * The applicant sends or changes their times. As with an answer, the applicant is the
 * session's account and the interview is found here, so the page can't name one. If the
 * interview isn't the one the page showed, or isn't open for times, or its times changed
 * elsewhere since (another tab), nothing is written: the page shows where it stands now.
 */
export async function sendTimes(picks: string[], timeZone: string, shown: ShownTimes): Promise<SendOutcome> {
  const session = await getSession();
  if (!session) return { kind: 'signin' };
  const view = await applicantInterview(session.discordId);
  if (!view || (view.status !== 'AWAITING_TIMES' && view.status !== 'TIMES_RECEIVED')) return { kind: 'stale' };
  if (view.requestedAt !== shown?.requestedAt || !Array.isArray(shown.slots) || !sameTimes(view.slots, shown.slots)) return { kind: 'stale' };
  const result = await submitTimes(view.id, session.discordId, picks, timeZone);
  if (result.ok) return { kind: 'sent' };
  if (result.reason === 'too_few_times' || result.reason === 'out_of_range' || result.reason === 'invalid') return { kind: 'refused', error: result.error };
  // Lost a race to an officer, Discord or another tab.
  return { kind: 'stale' };
}
