'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AVAILABILITY_PHONE_HINT } from '@/content/availability';
import { applyPaintRun, blockAt, dayBlocks, dragEdge, removeBlock, sameBlock, SLOTS, type Block, type SlotState, type Week, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { DayBlock, ROW } from './DayBlock';
import { useHourLabels } from './useHourLabels';

type Props = {
  week: Week;
  days: WeekDay[];
  /** Half-hour slots the guild clock is ahead of `zone`; 0 means the labels are guild time. */
  offsetSlots: number;
  /** The zone the week is painted in. */
  zone: string;
  /** ISO start of a (day, slot) this week in `zone`. */
  slotAt: (day: number, slot: number) => string;
  mode: SlotState;
  onWeek: (next: Week) => void;
  selected: Block | null;
  onSelect: (block: Block | null) => void;
  /** Opens the list alternative for a day (the keyboard/no-drag path). */
  onOpenDay: (day: WeekDay) => void;
};

const OPEN_AT_SLOT = 34; // 17:00
/** A touch held this long without moving becomes a paint stroke instead of a scroll. */
const HOLD_MS = 300;
const MOVE_SLOP = 8;

type Stroke = {
  kind: 'undecided' | 'paint' | 'swipe' | 'scroll';
  pointerType: string;
  x: number;
  y: number;
  day: number;
  slot: number;
  last: number | null;
  hold: ReturnType<typeof setTimeout> | null;
};
/** `grab` is how many rows below the dragged edge the finger landed, so the edge moves with it. */
type Gesture = Stroke | { kind: 'resize'; base: Week; origin: Block; edge: 'start' | 'end'; grab: number; live: Block };

const CELLS = Array.from({ length: SLOTS }, (_, slot) => (
  <div key={slot} className={cn('border-b bg-slot-empty', slot % 2 === 0 ? 'border-line-faint' : 'border-line-hairline')} style={{ height: ROW }} />
));

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      {dir === 'left' ? <path d="M9 2L4 7l5 5" /> : <path d="M5 2l5 5-5 5" />}
    </svg>
  );
}

/**
 * Mobile: one day at a time (docs/05 § Mobile; design/158-availability-blocks). A 44px day
 * switcher whose centre opens the list alternative, seven position dots, then a single
 * column of 48 rows at 34px in a 520px scroll region opened at 17:00. Painted time is drawn
 * as blocks, as on desktop.
 *
 * Gestures: tap empty paints one half-hour; tap a block selects it (tap it again or outside
 * to deselect), and its handles resize it. On touch, a vertical drag scrolls (the container
 * allows pan-y), while press-and-hold then drag paints a run; a horizontal swipe changes
 * day, wrapping. Handles take no pan, so a resize never scrolls or swipes. With a mouse, a
 * vertical drag paints straight away. Chevrons and the list do the same jobs, so nothing is
 * gesture-only.
 */
export function DayColumn({ week, days, offsetSlots, zone, slotAt, mode, onWeek, selected, onSelect, onOpenDay }: Props) {
  const [dayIndex, setDayIndex] = useState(() => days.find((d) => d.isToday)?.day ?? 0);
  const [resizing, setResizing] = useState<'start' | 'end' | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // Latest week, mode and callbacks for the native touch listener and for chaining several
  // paints inside one frame, where state has not re-rendered yet.
  const weekRef = useRef(week);
  const modeRef = useRef(mode);
  const onWeekRef = useRef(onWeek);
  const onSelectRef = useRef(onSelect);
  const day = days[dayIndex];
  const hours = useHourLabels(zone, slotAt, 'text-[11px] font-normal text-fg-muted', ROW);

  useEffect(() => {
    if (!gesture.current) weekRef.current = week;
    modeRef.current = mode;
    onWeekRef.current = onWeek;
    onSelectRef.current = onSelect;
  }, [week, mode, onWeek, onSelect]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = OPEN_AT_SLOT * ROW - 8;
  }, [dayIndex]);

  const rowsDown = useCallback((y: number) => (y - (colRef.current?.getBoundingClientRect().top ?? 0)) / ROW, []);
  const slotAtY = (y: number) => Math.max(0, Math.min(SLOTS - 1, Math.floor(rowsDown(y))));

  const commit = useCallback((next: Week) => {
    if (next === weekRef.current) return;
    weekRef.current = next;
    onWeekRef.current(next);
  }, []);

  /** Paint from the stroke's last half-hour to the one under `y`, filling rows a fast drag skipped. */
  const paintTo = useCallback(
    (g: Stroke, y: number) => {
      const slot = Math.max(0, Math.min(SLOTS - 1, Math.floor(rowsDown(y))));
      if (slot === g.last) return;
      commit(applyPaintRun(weekRef.current, g.day, g.last ?? slot, slot, modeRef.current));
      g.last = slot;
    },
    [rowsDown, commit],
  );

  // While painting by touch, stop the browser from scrolling and follow the finger here.
  // This must be a native, non-passive listener: React's synthetic touch events cannot
  // preventDefault a scroll, and pointermove is not delivered reliably once it starts.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (g?.kind !== 'paint' && g?.kind !== 'resize') return;
      e.preventDefault();
      const t = e.touches[0];
      if (g.kind === 'paint' && t) paintTo(g, t.clientY);
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [paintTo]);

  const step = (delta: number) => {
    setDayIndex((i) => (i + delta + 7) % 7);
    onSelect(null);
  };

  const startPaint = (g: Stroke) => {
    g.kind = 'paint';
    onSelectRef.current(null);
    paintTo(g, g.y);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // A press on a time label (its guild-time popup) or the × is the button's own.
    if (e.button !== 0 || target.closest('button')) return;
    const handle = target.closest<HTMLElement>('[data-edge]');
    if (handle) {
      const origin = blockAt(week, day.day, Number(handle.closest<HTMLElement>('[data-start]')?.dataset.start));
      if (!origin) return;
      e.preventDefault();
      // Captured on the scroll region, which outlives the handle as the block re-renders.
      e.currentTarget.setPointerCapture(e.pointerId);
      weekRef.current = week;
      const edge = handle.dataset.edge === 'start' ? 'start' : 'end';
      const grab = rowsDown(e.clientY) - (edge === 'start' ? origin.start : origin.end);
      gesture.current = { kind: 'resize', base: week, origin, edge, grab, live: origin };
      setResizing(edge);
      return;
    }
    if (!target.closest('[data-day]')) return;
    weekRef.current = week;
    const g: Stroke = { kind: 'undecided', pointerType: e.pointerType, x: e.clientX, y: e.clientY, day: day.day, slot: slotAtY(e.clientY), last: null, hold: null };
    if (e.pointerType === 'touch') g.hold = setTimeout(() => startPaint(g), HOLD_MS);
    gesture.current = g;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'resize') {
      // The handle's hit area reaches most of a row past its edge, so measure from where it was grabbed.
      const next = dragEdge(g.base, g.origin, g.edge, Math.round(rowsDown(e.clientY) - g.grab));
      if (sameBlock(next.block, g.live)) return;
      g.live = next.block;
      commit(next.week);
      onSelect(next.block);
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.kind === 'undecided' && Math.max(Math.abs(dx), Math.abs(dy)) > MOVE_SLOP) {
      if (g.hold) clearTimeout(g.hold);
      if (Math.abs(dx) > Math.abs(dy)) g.kind = 'swipe';
      else if (g.pointerType === 'touch') g.kind = 'scroll'; // native pan-y takes over
      else startPaint(g);
    }
    if (g.kind === 'paint' && g.pointerType !== 'touch') paintTo(g, e.clientY);
  };

  const finish = (e: React.PointerEvent | null) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'resize') {
      setResizing(null);
      if (e) onSelect(g.live);
      else {
        commit(g.base);
        onSelect(g.origin);
      }
      return;
    }
    if (g.hold) clearTimeout(g.hold);
    if (!e) return;
    if (g.kind === 'swipe') {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    } else if (g.kind === 'undecided') {
      const hit = blockAt(weekRef.current, g.day, g.slot);
      if (hit) onSelect(sameBlock(hit, selected) ? null : hit);
      else {
        onSelect(null);
        commit(applyPaintRun(weekRef.current, g.day, g.slot, g.slot, modeRef.current));
      }
    }
  };

  const hasSlots = (d: number) => Object.keys(week).some((k) => k.startsWith(`${d}:`));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-card border border-line bg-ink-850 px-1">
        <button type="button" onClick={() => step(-1)} aria-label="Previous day" className="flex h-11 w-11 items-center justify-center text-fg-2 hover:text-fg">
          <Chevron dir="left" />
        </button>
        <button
          type="button"
          onClick={() => onOpenDay(day)}
          aria-haspopup="dialog"
          aria-label={`${day.longName} ${day.date}: set hours from a list`}
          className="flex min-h-11 flex-col items-center justify-center px-4 transition-colors duration-[120ms] hover:text-teal"
        >
          <span className="text-[15px] font-semibold">{day.longName}</span>
          <span className="text-[11px] text-fg-3">{day.date} · tap to set from a list</span>
        </button>
        <button type="button" onClick={() => step(1)} aria-label="Next day" className="flex h-11 w-11 items-center justify-center text-fg-2 hover:text-fg">
          <Chevron dir="right" />
        </button>
      </div>
      <ol className="flex justify-center gap-2" aria-label="Days with painted hours">
        {days.map((d) => (
          <li
            key={d.day}
            className={cn('h-1.5 w-1.5 rounded-full', hasSlots(d.day) ? 'bg-teal' : 'bg-line-strong', d.day === dayIndex && 'ring-2 ring-line-strong ring-offset-2 ring-offset-ink-950')}
            aria-label={`${d.longName}${hasSlots(d.day) ? ', painted' : ''}${d.day === dayIndex ? ', shown' : ''}`}
          />
        ))}
      </ol>
      <p className="text-xs text-fg-3">
        {AVAILABILITY_PHONE_HINT}
        {offsetSlots === 0 && ' Times are guild time.'}
      </p>

      <div
        ref={scrollRef}
        data-blocks
        className="h-[520px] select-none overflow-y-auto rounded-card border border-line bg-ink-900 [touch-action:pan-y]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={() => finish(null)}
      >
        <div className="flex">
          <div className="w-[76px] shrink-0">
            {hours.map((label, slot) => (
              <div key={slot} className={cn('tabular flex items-center border-b pl-3 text-[11px] text-fg-muted', slot % 2 === 0 ? 'border-line-faint' : 'border-line-hairline')} style={{ height: ROW }}>
                {label}
              </div>
            ))}
          </div>
          <div ref={colRef} data-day={day.day} role="list" aria-label={day.longName} className="relative flex-1 border-l border-line-faint">
            <div aria-hidden>{CELLS}</div>
            {dayBlocks(week, day.day).map((b) => {
              const isSelected = sameBlock(b, selected);
              return (
                <DayBlock
                  key={b.start}
                  block={b}
                  selected={isSelected}
                  resizing={isSelected ? resizing : null}
                  onRemove={() => {
                    commit(removeBlock(weekRef.current, b));
                    onSelect(null);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
