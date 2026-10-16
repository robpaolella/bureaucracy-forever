'use server';

import { answerProposal, applicantInterview } from '@/lib/interviews';
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
