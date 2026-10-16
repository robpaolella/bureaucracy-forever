'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { INTERVIEW } from '@/content/interview';

const StaleContext = createContext<{ stale: boolean; setStale: (stale: boolean) => void } | null>(null);

/**
 * Holds "this changed while the page was open" across the refresh that shows the interview's
 * current state, which replaces the card that found out. `stale` is the starting value.
 */
export function StaleNoticeHost({ stale: initial = false, children }: { stale?: boolean; children: ReactNode }) {
  const [stale, setStale] = useState(initial);
  return <StaleContext.Provider value={{ stale, setStale }}>{children}</StaleContext.Provider>;
}

/** Sets or clears the notice; does nothing outside a host. */
export function useSetStale(): (stale: boolean) => void {
  return useContext(StaleContext)?.setStale ?? (() => {});
}

/** The teal notice at the top of the card (approved design 367, error-stale). */
export function StaleNotice() {
  if (!useContext(StaleContext)?.stale) return null;
  return <div role="status" className="w-full rounded-card border border-teal-line bg-teal-wash px-5 py-4 text-left text-sm text-teal-text">{INTERVIEW.stale}</div>;
}
