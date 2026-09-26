'use client';

import { useEffect, useRef, useState } from 'react';
import { applyPaint, applyPaintRun, fmtSlot, parseKey, SLOTS, slotKey, type PaintMode, type Week, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { FILL } from './WeekGrid';

type Props = {
  week: Week;
  days: WeekDay[];
  offsetSlots: number;
  mode: PaintMode;
  onWeek: (next: Week) => void;
  /** Opens the list alternative for a day (the keyboard/no-drag path). */
  onOpenDay: (day: WeekDay) => void;
};

const ROW = 34;
const OPEN_AT_SLOT = 34; // 17:00
/** A touch held this long without moving becomes a paint stroke instead of a scroll. */
const HOLD_MS = 300;
const MOVE_SLOP = 8;

type Gesture = {
  pointerType: string;
  x: number;
  y: number;
  key: string | null;
  kind: 'undecided' | 'paint' | 'swipe' | 'scroll';
  last: string | null;
  hold: ReturnType<typeof setTimeout> | null;
};

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      {dir === 'left' ? <path d="M9 2L4 7l5 5" /> : <path d="M5 2l5 5-5 5" />}
    </svg>
  );
}

/**
 * Mobile: one day at a time (docs/05 § Mobile). A 44px day switcher whose centre opens
 * the list alternative, seven position dots, then a single column of 48 rows at 34px in
 * a 520px scroll region opened at 17:00.
 *
 * Gestures: tap paints one cell. On touch, a vertical drag scrolls (the container allows
 * pan-y), while press-and-hold then drag paints a run; a horizontal swipe changes day,
 * wrapping. With a mouse, a vertical drag paints straight away. Chevrons and the list do
 * the same jobs, so nothing is gesture-only.
 */
export function DayColumn({ week, days, offsetSlots, mode, onWeek, onOpenDay }: Props) {
  const [dayIndex, setDayIndex] = useState(() => days.find((d) => d.isToday)?.day ?? 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  // Latest week, mode and callback for the native touch listener and for chaining several
  // paints inside one frame, where state has not re-rendered yet.
  const weekRef = useRef(week);
  const modeRef = useRef(mode);
  const onWeekRef = useRef(onWeek);
  const day = days[dayIndex];

  useEffect(() => {
    weekRef.current = week;
    modeRef.current = mode;
    onWeekRef.current = onWeek;
  }, [week, mode, onWeek]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = OPEN_AT_SLOT * ROW - 8;
  }, [dayIndex]);

  const keyAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-key]') as HTMLElement | null)?.dataset.key ?? null;

  /** Paint from the stroke's last cell to `key`, filling any rows a fast drag skipped. */
  const paintTo = (g: Gesture, key: string) => {
    const from = parseKey(g.last ?? key);
    const to = parseKey(key);
    const next =
      from && to && from.day === to.day
        ? applyPaintRun(weekRef.current, to.day, from.slot, to.slot, modeRef.current)
        : applyPaint(weekRef.current, key, modeRef.current);
    weekRef.current = next;
    onWeekRef.current(next);
    g.last = key;
  };

  // While painting by touch, stop the browser from scrolling and follow the finger here.
  // This must be a native, non-passive listener: React's synthetic touch events cannot
  // preventDefault a scroll, and pointermove is not delivered reliably once it starts.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      const g = gesture.current;
      if (g?.kind !== 'paint') return;
      e.preventDefault();
      const t = e.touches[0];
      const key = t ? keyAt(t.clientX, t.clientY) : null;
      if (key && key !== g.last) paintTo(g, key);
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
    // paintTo reads everything through refs, so this listener never goes stale.
  }, []);

  const step = (delta: number) => setDayIndex((i) => (i + delta + 7) % 7);

  const startPaint = (g: Gesture) => {
    g.kind = 'paint';
    if (g.key) paintTo(g, g.key);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key ?? null;
    const g: Gesture = { pointerType: e.pointerType, x: e.clientX, y: e.clientY, key, kind: 'undecided', last: null, hold: null };
    if (e.pointerType === 'touch' && key) g.hold = setTimeout(() => startPaint(g), HOLD_MS);
    gesture.current = g;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.kind === 'undecided' && Math.max(Math.abs(dx), Math.abs(dy)) > MOVE_SLOP) {
      if (g.hold) clearTimeout(g.hold);
      if (Math.abs(dx) > Math.abs(dy)) g.kind = 'swipe';
      else if (g.pointerType === 'touch') g.kind = 'scroll'; // native pan-y takes over
      else startPaint(g);
    }
    if (g.kind === 'paint' && g.pointerType !== 'touch') {
      const key = keyAt(e.clientX, e.clientY);
      if (key && key !== g.last) paintTo(g, key);
    }
  };

  const finish = (e: React.PointerEvent | null) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.hold) clearTimeout(g.hold);
    if (!e) return;
    if (g.kind === 'swipe') {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    } else if (g.kind === 'undecided' && g.key) {
      paintTo(g, g.key);
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
      <p className="text-xs text-fg-3">Tap to paint a half-hour. Hold, then drag, to paint a run. Swipe sideways for another day.</p>

      <div
        ref={scrollRef}
        className="h-[520px] select-none overflow-y-auto rounded-card border border-line bg-ink-900 [touch-action:pan-y]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={() => finish(null)}
      >
        {Array.from({ length: SLOTS }, (_, slot) => {
          const key = slotKey(day.day, slot);
          const state = week[key];
          const onHour = slot % 2 === 0;
          const line = onHour ? 'border-line-faint' : 'border-line-hairline';
          return (
            <div key={slot} className="flex items-stretch" style={{ height: ROW }}>
              <div className={cn('tabular flex w-[76px] shrink-0 items-center border-b pl-3 text-[11px] text-fg-muted', line)}>{onHour ? fmtSlot(slot) : ''}</div>
              <button
                type="button"
                data-key={key}
                tabIndex={-1}
                aria-label={`${day.name} ${fmtSlot(slot)}`}
                aria-pressed={state ? true : false}
                title={state === 'available' ? 'Available' : state === 'if-needed' ? 'If needed' : undefined}
                className={cn('flex-1 border-b border-l border-l-line-faint', line, state ? FILL[state] : 'bg-slot-empty')}
              />
              <div className={cn('tabular flex w-[76px] shrink-0 items-center justify-end border-b border-l border-l-line-faint pr-3 text-[11px] text-fg-3', line)}>{onHour ? fmtSlot(slot + offsetSlots) : ''}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
