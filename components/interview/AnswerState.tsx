'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { INTERVIEW } from '@/content/interview';

type AnswerState = { stale: boolean; moved: boolean; set: (next: { stale: boolean; moved: boolean }) => void };
const AnswerContext = createContext<AnswerState | null>(null);

/**
 * What an answer leaves behind across the refresh that replaces the card it came from: the
 * "changed while the page was open" notice, and whether to move focus to the new card's title.
 * `stale` is the starting value.
 */
export function AnswerStateHost({ stale: initial = false, children }: { stale?: boolean; children: ReactNode }) {
  const [state, setState] = useState({ stale: initial, moved: false });
  return <AnswerContext.Provider value={{ ...state, set: setState }}>{children}</AnswerContext.Provider>;
}

/** Records an answer's outcome; does nothing outside a host. */
export function useSetAnswerState(): AnswerState['set'] {
  return useContext(AnswerContext)?.set ?? (() => {});
}

/** The teal notice at the top of the card (approved design 367, error-stale). */
export function StaleNotice() {
  if (!useContext(AnswerContext)?.stale) return null;
  return <div role="status" className="w-full rounded-card border border-teal-line bg-teal-wash px-5 py-4 text-left text-sm text-teal-text">{INTERVIEW.stale}</div>;
}

/** The card's title. After an answer it takes focus, so a screen reader hears the new state. */
export function CardTitle({ children }: { children: string }) {
  const answer = useContext(AnswerContext);
  const ref = useRef<HTMLHeadingElement>(null);
  const moved = answer?.moved;
  useEffect(() => {
    if (!moved) return;
    ref.current?.focus();
    answer.set({ stale: answer.stale, moved: false });
  }, [moved, children, answer]);
  return (
    <h1 ref={ref} tabIndex={-1} className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] outline-none md:text-[44px]">
      {children}
    </h1>
  );
}
