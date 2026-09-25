'use client';

import { useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useDisclosure } from './useDismiss';

type NavGroupProps = {
  label: string;
  /** Officers group takes sand and carries the pending count. */
  tone?: 'neutral' | 'officer';
  badge?: ReactNode;
  /** Popover width: Members 260, Officers 288. */
  width?: number;
  children: ReactNode;
};

export function Chevron({ className }: { className?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" strokeWidth="1.6" strokeLinecap="round" className={cn('stroke-current', className)} aria-hidden>
      <path d="M2 4l3 3 3-3" />
    </svg>
  );
}

/**
 * A disclosure: 44px hit box around a 32px chip, opening a popover of links on ink-800.
 * Closes on Escape, outside click, or navigation; Escape returns focus to the chip.
 */
export function NavGroup({ label, tone = 'neutral', badge, width = 260, children }: NavGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, close, toggle } = useDisclosure(containerRef, triggerRef);
  const id = useId();

  return (
    <div ref={containerRef} className="relative">
      <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={id} onClick={toggle} className="flex h-11 items-center">
        <span
          className={cn(
            'flex h-8 items-center gap-[7px] rounded-control border px-2.5 text-sm font-semibold transition-colors duration-[120ms]',
            tone === 'officer'
              ? 'border-sand-dim bg-sand-wash text-sand'
              : open
                ? 'border-line-strong bg-ink-800 text-fg'
                : 'border-line text-fg-2 hover:text-fg',
          )}
        >
          {label}
          {badge}
          <Chevron className={tone === 'officer' ? 'text-sand' : open ? 'text-teal' : 'text-fg-3'} />
        </span>
      </button>
      {/* Class-driven visibility: a `flex` utility would override the `[hidden]` reset. */}
      <div
        id={id}
        style={{ width }}
        className={cn(
          'absolute left-0 top-full z-20 mt-2 flex-col gap-0.5 rounded-card border border-line-strong bg-ink-800 p-2 shadow-pop',
          open ? 'flex' : 'hidden',
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) close();
        }}
      >
        {children}
      </div>
    </div>
  );
}
