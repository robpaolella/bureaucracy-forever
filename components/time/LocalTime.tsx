'use client';

import { useId, useLayoutEffect, useRef } from 'react';
import { useDisclosure } from '@/components/shell/useDismiss';
import { cn } from '@/lib/cn';
import { viewerTime } from '@/lib/time';
import { useViewerTimeZone } from './useViewerTimeZone';

type Props = {
  /** ISO instant. */
  startsAt: string;
  /** 0 renders a single instant ("8:00 PM") instead of a range. */
  durationMin: number;
  className?: string;
};

/** A click this soon after a hover opened the popup is the same gesture, not a toggle. */
const HOVER_CLICK_MS = 400;

/**
 * A time in the viewer's zone ("8:00 – 11:00 PM EDT") with guild time on mouse hover, tap,
 * click or keyboard focus, and in the accessible name. Before the zone is known, or when it
 * is guild time, it shows guild time once, labelled, with no popup. The popup is the item
 * tooltip's disclosure (ItemName): Escape, an outside press and tabbing away close it.
 */
export function LocalTime({ startsAt, durationMin, className }: Props) {
  const viewer = useViewerTimeZone();
  const time = viewerTime(new Date(startsAt), durationMin, viewer?.zone ?? null);
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const { open, toggle, close } = useDisclosure(containerRef, triggerRef);
  const panelId = useId();
  const hoverOpenedAt = useRef(0);

  // Keep the popup inside the viewport: shift it left when the time sits near the right edge.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    panel.style.left = '0px';
    const overflow = panel.getBoundingClientRect().right - (window.innerWidth - 16);
    if (overflow > 0) panel.style.left = `${-overflow}px`;
  }, [open]);

  if (!time.guild) return <span className={cn('tabular text-sm font-semibold text-fg', className)}>{time.text}</span>;

  return (
    <span
      ref={containerRef}
      className={cn('relative inline-block tabular text-sm font-semibold text-fg', className)}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && open) close();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={time.label}
        aria-controls={panelId}
        aria-expanded={open}
        onClick={() => {
          // The timestamp alone, not `open`: hover and click can land before a re-render.
          if (Date.now() - hoverOpenedAt.current < HOVER_CLICK_MS) return;
          toggle();
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse' || open) return;
          hoverOpenedAt.current = Date.now();
          toggle();
        }}
        onFocus={(e) => {
          if (!open && e.currentTarget.matches(':focus-visible')) toggle();
        }}
        // The 44px hit area sits on a pseudo-element, so the line keeps its height.
        className="relative rounded-sm text-left underline decoration-fg-3 decoration-dotted underline-offset-4 after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal"
      >
        {time.text}
      </button>
      {/* pt-1 rather than a margin: the gap stays inside the container, so the pointer can
          move onto the popup without closing it. */}
      <span ref={panelRef} id={panelId} role="tooltip" className={cn('absolute left-0 top-full z-30 pt-1', open ? 'block' : 'hidden')}>
        <span className="block whitespace-nowrap font-normal rounded-card border border-line-strong bg-ink-800 px-3 py-2 text-[13px] text-fg shadow-pop">{time.guild}</span>
      </span>
    </span>
  );
}
