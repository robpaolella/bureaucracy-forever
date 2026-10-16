import type { Metadata } from 'next';
import { InterviewView } from '@/components/interview/InterviewView';
import { INTERVIEW } from '@/content/interview';
import { interviewGate } from '@/lib/apply-gate';
import { SITE_NAME } from '@/lib/config';

const TITLE = `${INTERVIEW.pageTitle} — ${SITE_NAME}`;

/** Root layout's openGraph/twitter are whole-object overrides, not merged: repeat siteName/locale/card here too. */
export const metadata: Metadata = {
  title: INTERVIEW.pageTitle,
  description: INTERVIEW.description,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_US', title: TITLE, description: INTERVIEW.description },
  twitter: { card: 'summary_large_image', title: TITLE, description: INTERVIEW.description },
  robots: { index: false, follow: false },
};

/**
 * The applicant's private interview page, linked from the bot's DM (SYNC-SPEC §12). It
 * takes no input: each signed-in visitor sees their own latest interview, so a forwarded
 * link shows each person theirs. Gated here on the server, not in proxy.ts.
 */
export default async function InterviewPage() {
  return <InterviewView gate={await interviewGate()} now={new Date()} />;
}
