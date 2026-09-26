'use client';

import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { CountBadge } from './Badges';
import { Button } from './Button';
import { Sheet } from './Sheet';

type Props = {
  /** The 44px controls, in order. */
  children: ReactNode;
  /** "38 of 41 shown". */
  summary: ReactNode;
  /** How many filters are active. Drives the Clear button and the badge on the phone trigger. */
  activeCount: number;
  onClear: () => void;
  className?: string;
};

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M2 4h12M4.5 8h7M7 12h2" />
    </svg>
  );
}

/**
 * One row of filters on an ink-850 card with the shown-count on the right and a
 * "Clear filters" ghost button that appears only while a filter is active (docs/04 §
 * Roster). Below md the controls move behind a 44px "Filters" button that opens a Sheet,
 * with the active count riding on the button.
 */
export function FilterBar({ children, summary, activeCount, onClear, className }: Props) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const active = activeCount > 0;

  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-card border border-line bg-ink-850 px-4 py-3 md:px-5', className)}>
      <div className="hidden flex-1 flex-wrap items-center gap-2.5 md:flex">{children}</div>
      <Button variant="secondary" className="md:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls={sheetId}>
        <FilterIcon />
        Filters
        {active && <CountBadge aria-label={`${activeCount} active`}>{activeCount}</CountBadge>}
      </Button>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="tabular text-[13px] text-fg-2">{summary}</span>
        {active && (
          <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={onClear}>
            Clear filters
          </Button>
        )}
      </div>
      <Sheet
        id={sheetId}
        open={open}
        onClose={() => setOpen(false)}
        title="Filters"
        actions={
          <>
            {active && (
              <Button variant="ghost" onClick={onClear}>
                Clear filters
              </Button>
            )}
            <Button onClick={() => setOpen(false)}>Done</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 [&>*]:w-full">{children}</div>
      </Sheet>
    </div>
  );
}
