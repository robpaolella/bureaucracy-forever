import Image from 'next/image';
import type { ReactNode } from 'react';
import { INTERVIEW } from '@/content/interview';
import { StaleNotice } from './StaleNotice';

type Props = { eyebrow?: string; title: string; body: ReactNode; extra?: ReactNode; actions?: ReactNode; answer?: ReactNode };

/** The row of a card's buttons. */
export const ACTIONS_ROW = 'flex flex-col gap-3 sm:flex-row';

/**
 * StatusPage's content in the squeeze page's one centred card (approved design 341): any stale
 * notice, mark, eyebrow, title, then anything the state adds above its body, then its actions.
 * `answer` replaces `actions` when the state brings its own row (and anything above it).
 */
export function InterviewCard({ eyebrow = INTERVIEW.eyebrow, title, body, extra, actions, answer }: Props) {
  return (
    <InterviewStage>
      <div className="flex w-full max-w-[520px] flex-col items-center gap-6 rounded-card border border-line bg-ink-850 px-6 py-10 text-center md:px-10 md:py-12">
        <StaleNotice />
        <Image src="/brand/mark.png" alt="" width={42} height={48} className="w-10 opacity-40 md:w-12" />
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{title}</h1>
        {extra}
        <p className="text-[15px] leading-[1.7] text-fg-2">{body}</p>
        {answer}
        {actions && <div className={ACTIONS_ROW}>{actions}</div>}
      </div>
    </InterviewStage>
  );
}

/** The space under the logo bar, centring its one card. */
export function InterviewStage({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 items-center justify-center px-4 pb-14 pt-6 min-[960px]:px-6 min-[960px]:pb-[72px] min-[960px]:pt-8">{children}</div>;
}
