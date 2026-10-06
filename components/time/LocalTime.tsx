'use client';

import { useId, useLayoutEffect, useRef } from 'react';
import { useDisclosure } from '@/components/shell/useDismiss';
import { cn } from '@/lib/cn';
import { viewerTime, type ViewerTimeOptions } from '@/lib/time';
import { useViewerTimeZone } from './useViewerTimeZone';

type Props = {
  /** ISO instant. */
  startsAt: string;
  /** 0 renders a single instant ("8:00 PM") instead of a range. */
  durationMin: number;
  className?: string;
  /** Show this zone instead of the viewer's: an availability week shows the zone it was painted in. */
  zone?: string;
  weekday?: ViewerTimeOptions['weekday'];
  /**
   * For a row label in a grid, under a header that names the zone: no zone name, and the
   * popup is placed against the viewport so the grid's scroll box cannot clip it.
   */
  dense?: boolean;
  /** Height of the hit area in px. A grid with labels closer than 44px passes their spacing. */
  hitHeight?: number;
};

/**
 * Where a popup can show: the viewport less a 16px margin at the sides, cut to the visible
 * area of the nearest scrolling ancestor (a dialog body), less its scrollbar.
 */
function clipBox(el: HTMLElement): { top: number; right: number; bottom: number } {
  const box = { top: 0, right: window.innerWidth - 16, bottom: window.innerHeight };
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (getComputedStyle(node).overflowY === 'visible') continue;
    const r = node.getBoundingClientRect();
    box.top = Math.max(box.top, r.top + node.clientTop);
    box.right = Math.min(box.right, r.left + node.clientLeft + node.clientWidth);
    box.bottom = Math.min(box.bottom, r.top + node.clientTop + node.clientHeight);
    break;
  }
  return box;
}

/** A click this soon after a hover opened the popup is the same gesture, not a toggle. */
const HOVER_CLICK_MS = 400;

/**
 * A time in the viewer's zone ("8:00 – 11:00 PM EDT") with guild time on mouse hover, tap,
 * click or keyboard focus, and in the accessible name. Before the zone is known, or when it
 * is guild time, it shows guild time once, labelled, with no popup. The popup is the item
 * tooltip's disclosure (ItemName): Escape, an outside press and tabbing away close it.
 */
export function LocalTime({ startsAt, durationMin, className, zone, weekday, dense = false, hitHeight = 44 }: Props) {
  const viewer = useViewerTimeZone();
  // `viewer` is null on the server, so navigator is only read in the browser.
  const time = viewerTime(new Date(startsAt), durationMin, zone ?? viewer?.zone ?? null, viewer ? navigator.language : undefined, { weekday, zoneName: !dense });
  const containerRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const { open, toggle, close } = useDisclosure(containerRef, triggerRef);
  const panelId = useId();
  const hoverOpenedAt = useRef(0);

  // Keep the popup where it can be seen: shift it left when the time sits near the right
  // edge, and put it above the time when there is no room below.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!open || !panel || !trigger) return;
    if (!dense) {
      panel.style.left = '0px';
      delete panel.dataset.flip;
      const clip = clipBox(panel);
      const overflow = panel.getBoundingClientRect().right - clip.right;
      if (overflow > 0) panel.style.left = `${-overflow}px`;
      const p = panel.getBoundingClientRect();
      if (p.bottom > clip.bottom && trigger.getBoundingClientRect().top - p.height >= clip.top) panel.dataset.flip = '';
      return;
    }
    // Fixed, below the label, or above it when there is no room below.
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    panel.style.left = `${Math.max(16, Math.min(t.left, window.innerWidth - 16 - p.width))}px`;
    panel.style.top = `${t.bottom + p.height > window.innerHeight ? t.top - p.height : t.bottom}px`;
    // A fixed popup would drift from its label on scroll, so scrolling closes it.
    const onScroll = () => close();
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
    };
  }, [open, dense, close]);

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
        // The hit area sits on a pseudo-element, so the line keeps its height.
        style={{ '--hit': `${hitHeight}px` } as React.CSSProperties}
        className={cn(
          "relative rounded-sm text-left underline decoration-fg-3 decoration-dotted after:absolute after:inset-x-0 after:top-1/2 after:h-[var(--hit)] after:-translate-y-1/2 after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal",
          dense ? 'underline-offset-2' : 'underline-offset-4',
        )}
      >
        {time.text}
      </button>
      {/* pt-1 rather than a margin: the gap stays inside the container, so the pointer can
          move onto the popup without closing it. */}
      <span
        ref={panelRef}
        id={panelId}
        role="tooltip"
        // A dense popup covers the next rows; presses go through it to their controls.
        className={cn(
          dense ? 'pointer-events-none fixed z-40 py-1' : 'absolute left-0 top-full z-30 pt-1 data-[flip]:bottom-full data-[flip]:top-auto data-[flip]:pb-1 data-[flip]:pt-0',
          open ? 'block' : 'hidden',
        )}
      >
        <span className="block whitespace-nowrap font-normal rounded-card border border-line-strong bg-ink-800 px-3 py-2 text-[13px] text-fg shadow-pop">{time.guild}</span>
      </span>
    </span>
  );
}
