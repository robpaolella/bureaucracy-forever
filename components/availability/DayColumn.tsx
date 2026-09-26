'use client';

import { useEffect, useRef, useState } from 'react';
import { applyPaint, fmtSlot, parseKey, SLOTS, slotKey, type PaintMode, type Week, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { FILL } from './WeekGrid';

type Props = {
  week: Week;
  days: WeekDay[];
  offsetSlots: number;
  mode: PaintMode;
  onWeek: (next: Week) => void;
};

const ROW = 34;
const OPEN_AT_SLOT = 34; // 17:00

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      {dir === 'left' ? <path d="M9 2L4 7l5 5" /> : <path d="M5 2l5 5-5 5" />}
    </svg>
  );
}

/**
 * Mobile: one day at a time (docs/05 § Mobile). A 44px day switcher, seven position
 * dots, then a single column of 48 rows at 34px in a 520px scroll region opened at 17:00.
 * Tap paints a cell; a vertical drag paints a run; a horizontal swipe changes day, with
 * the days wrapping. Chevrons do the same, so nothing is gesture-only.
 */
export function DayColumn({ week, days, offsetSlots, mode, onWeek }: Props) {
  const [dayIndex, setDayIndex] = useState(() => days.find((d) => d.isToday)?.day ?? 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; key: string | null; kind: 'undecided' | 'paint' | 'swipe'; last: string | null } | null>(null);
  const day = days[dayIndex];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = OPEN_AT_SLOT * ROW - 8;
  }, [dayIndex]);

  const step = (delta: number) => setDayIndex((i) => (i + delta + 7) % 7);

  const paint = (key: string) => onWeek(applyPaint(week, key, mode));

  const keyAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-key]') as HTMLElement | null)?.dataset.key ?? null;

  const onPointerDown = (e: React.PointerEvent) => {
    const key = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')?.dataset.key ?? null;
    gesture.current = { x: e.clientX, y: e.clientY, key, kind: 'undecided', last: null };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.kind === 'undecided') {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) g.kind = 'swipe';
      else if (Math.abs(dy) > 6 && g.key) {
        g.kind = 'paint';
        paint(g.key);
        g.last = g.key;
      }
    }
    if (g.kind === 'paint') {
      const key = keyAt(e.clientX, e.clientY);
      if (key && key !== g.last) {
        // Fill any rows skipped by a fast drag.
        const from = parseKey(g.last ?? key);
        const to = parseKey(key);
        if (from && to && from.day === to.day) {
          let next = week;
          const [a, b] = from.slot <= to.slot ? [from.slot, to.slot] : [to.slot, from.slot];
          for (let s = a; s <= b; s++) next = applyPaint(next, slotKey(to.day, s), mode);
          onWeek(next);
        } else paint(key);
        g.last = key;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.kind === 'swipe') {
      const dx = e.clientX - g.x;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
    } else if (g.kind === 'undecided' && g.key) {
      paint(g.key);
    }
  };

  const hasSlots = (d: number) => Object.keys(week).some((k) => k.startsWith(`${d}:`));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-card border border-line bg-ink-850 px-1">
        <button type="button" onClick={() => step(-1)} aria-label="Previous day" className="flex h-11 w-11 items-center justify-center text-fg-2 hover:text-fg">
          <Chevron dir="left" />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[15px] font-semibold">{day.longName}</span>
          <span className="text-[11px] text-fg-3">{day.date}</span>
        </div>
        <button type="button" onClick={() => step(1)} aria-label="Next day" className="flex h-11 w-11 items-center justify-center text-fg-2 hover:text-fg">
          <Chevron dir="right" />
        </button>
      </div>
      <ol className="flex justify-center gap-2" aria-label="Days with painted hours">
        {days.map((d) => (
          <li key={d.day} className={cn('h-1.5 w-1.5 rounded-full', hasSlots(d.day) ? 'bg-teal' : 'bg-line-strong', d.day === dayIndex && 'ring-2 ring-line-strong ring-offset-2 ring-offset-ink-950')} aria-label={`${d.longName}${hasSlots(d.day) ? ', painted' : ''}`} />
        ))}
      </ol>

      <div
        ref={scrollRef}
        className="h-[520px] select-none overflow-y-auto rounded-card border border-line bg-ink-900 [touch-action:none]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (gesture.current = null)}
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
                aria-label={`${day.name} ${fmtSlot(slot)}`}
                aria-pressed={state ? true : false}
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
