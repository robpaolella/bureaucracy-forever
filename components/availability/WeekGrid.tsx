'use client';

import { useEffect, useRef, useState } from 'react';
import {
  applyPaintRun,
  blockAt,
  dayBlocks,
  dragEdge,
  removeBlock,
  sameBlock,
  SLOTS,
  type Block,
  type PaintMode,
  type Week,
  type WeekDay,
} from '@/lib/availability';
import { cn } from '@/lib/cn';
import { useHourLabels } from './useHourLabels';
import { ROW, WeekBlock } from './WeekBlock';

export { FILL } from './WeekBlock';

type Props = {
  week: Week;
  days: WeekDay[];
  offsetSlots: number;
  /** The zone the week is painted in. */
  zone: string;
  /** ISO start of a (day, slot) this week in `zone`. */
  slotAt: (day: number, slot: number) => string;
  mode: PaintMode;
  onWeek: (next: Week) => void;
  selected: Block | null;
  onSelect: (block: Block | null) => void;
  onOpenDay: (day: WeekDay) => void;
};

/** How far a press may wander and still count as a click. */
const MOVE_SLOP = 4;

type Gesture =
  | { kind: 'press'; day: number; slot: number; x: number; y: number }
  | { kind: 'paint'; day: number; slot: number }
  | { kind: 'resize'; base: Week; origin: Block; edge: 'start' | 'end'; live: Block };

const CELLS = Array.from({ length: SLOTS }, (_, slot) => (
  <div key={slot} className={cn('h-[19px] border-b bg-slot-empty', slot % 2 === 0 ? 'border-line-faint' : 'border-line-hairline')} />
));

/**
 * The desktop grid (docs/05 § The grid; design/158-availability-blocks): a 92px gutter, a 46px
 * header, 48 rows of 19px. Painted time is drawn as blocks. Dragging empty space paints a run in
 * the chosen mode; a click selects a block, or paints one half-hour on empty space; a handle drag
 * resizes. Blocks are not Tab stops: the day headers open the keyboard alternative. Hour labels
 * give guild time on hover, tap and focus; when the zone is guild time the gutter says so instead.
 */
export function WeekGrid({ week, days, offsetSlots, zone, slotAt, mode, onWeek, selected, onSelect, onOpenDay }: Props) {
  const hours = useHourLabels(zone, slotAt, 'text-[10px] font-normal text-fg-muted', ROW);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cols = useRef<Array<HTMLDivElement | null>>([]);
  const gesture = useRef<Gesture | null>(null);
  // Latest week for chaining several changes inside one frame, before state re-renders.
  const weekRef = useRef(week);
  const [active, setActive] = useState<{ kind: 'paint' } | { kind: 'resize'; edge: 'start' | 'end' } | null>(null);

  useEffect(() => {
    weekRef.current = week;
  }, [week]);

  // A press anywhere outside the grid's body deselects.
  useEffect(() => {
    if (!selected) return;
    const onDown = (e: PointerEvent) => {
      if (!bodyRef.current?.contains(e.target as Node)) onSelect(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [selected, onSelect]);

  const commit = (next: Week) => {
    if (next === weekRef.current) return;
    weekRef.current = next;
    onWeek(next);
  };

  const slotAtY = (y: number) => {
    const top = cols.current[0]?.getBoundingClientRect().top ?? 0;
    return Math.max(0, Math.min(SLOTS - 1, Math.floor((y - top) / ROW)));
  };
  const dayAtX = (x: number) => {
    const i = cols.current.findIndex((c) => c && x < c.getBoundingClientRect().right);
    return i === -1 ? days.length - 1 : i;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const col = target.closest<HTMLElement>('[data-day]');
    const handle = target.closest<HTMLElement>('[data-edge]');
    // The gutter's time labels and the × are buttons that handle their own presses.
    if (e.button !== 0 || !col || (!handle && target.closest('button'))) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const day = Number(col.dataset.day);
    if (handle) {
      const origin = blockAt(weekRef.current, day, Number(handle.closest<HTMLElement>('[data-start]')?.dataset.start));
      if (!origin) return;
      const edge = handle.dataset.edge === 'start' ? 'start' : 'end';
      gesture.current = { kind: 'resize', base: weekRef.current, origin, edge, live: origin };
      setActive({ kind: 'resize', edge });
      onSelect(origin);
      return;
    }
    gesture.current = { kind: 'press', day, slot: slotAtY(e.clientY), x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'resize') {
      const step = dragEdge(g.base, g.origin, g.edge, slotAtY(e.clientY));
      if (sameBlock(step.block, g.live)) return;
      g.live = step.block;
      commit(step.week);
      onSelect(step.block);
      return;
    }
    if (g.kind === 'press') {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) <= MOVE_SLOP) return;
      gesture.current = { kind: 'paint', day: g.day, slot: g.slot };
      setActive({ kind: 'paint' });
      onSelect(null);
      commit(applyPaintRun(weekRef.current, g.day, g.slot, g.slot, mode));
      return onPointerMove(e);
    }
    // Paint from the stroke's last half-hour, filling rows a fast drag skipped; a stroke
    // crossing into another day carries on there.
    const day = dayAtX(e.clientX);
    const slot = slotAtY(e.clientY);
    if (day === g.day && slot === g.slot) return;
    commit(applyPaintRun(weekRef.current, day, day === g.day ? g.slot : slot, slot, mode));
    gesture.current = { kind: 'paint', day, slot };
  };

  const finish = (cancelled: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setActive(null);
    if (!g) return;
    if (g.kind === 'resize' && cancelled) {
      commit(g.base);
      onSelect(g.origin);
    } else if (g.kind === 'press' && !cancelled) {
      const hit = blockAt(weekRef.current, g.day, g.slot);
      if (hit) onSelect(sameBlock(hit, selected) ? null : hit);
      else {
        onSelect(null);
        commit(applyPaintRun(weekRef.current, g.day, g.slot, g.slot, mode));
      }
    }
  };

  return (
    <div className="rounded-card border border-line bg-ink-900">
      <div className="flex h-[46px] items-stretch rounded-t-[7px] border-b border-line bg-ink-850">
        <div className={cn('flex w-[92px] shrink-0 items-center pl-3.5 text-[10px] font-semibold uppercase tracking-[0.12em]', offsetSlots === 0 ? 'text-sand' : 'text-teal')}>
          {offsetSlots === 0 ? 'Guild' : 'Yours'}
        </div>
        {days.map((d) => (
          <div key={d.day} className="flex flex-1 basis-0 border-l border-line-faint">
            <button
              type="button"
              onClick={() => onOpenDay(d)}
              aria-haspopup="dialog"
              aria-label={`${d.longName} ${d.date}: set hours from a list`}
              className={cn('flex h-full w-full flex-col justify-center gap-0.5 pl-3 text-left transition-colors duration-[120ms] hover:bg-ink-800', d.day === 6 && 'rounded-tr-[7px]')}
            >
              <span className={cn('text-[13px] font-semibold', d.isToday ? 'text-sand' : 'text-fg')}>{d.name}</span>
              <span className="text-[11px] text-fg-3">{d.date}</span>
            </button>
          </div>
        ))}
      </div>

      <div
        ref={bodyRef}
        className="flex select-none [touch-action:none]"
        role="group"
        aria-label="Weekly availability"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
      >
        <div className="w-[92px] shrink-0">
          {hours.map((label, slot) => (
            <div key={slot} className={cn('tabular flex h-[19px] items-center border-b pl-3.5 text-[10px] text-fg-muted', slot % 2 === 0 ? 'border-line-faint' : 'border-line-hairline')}>
              {label}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <div
            key={d.day}
            ref={(el) => {
              cols.current[d.day] = el;
            }}
            data-day={d.day}
            role="list"
            aria-label={d.longName}
            className="relative flex-1 basis-0 cursor-crosshair border-l border-line-faint"
          >
            {/* The Sunday corner is rounded here, not clipped on the grid, so a selected
                block's outline at the right or bottom edge stays whole. */}
            <div aria-hidden className={cn(d.day === 6 && 'overflow-hidden rounded-br-[7px]')}>
              {CELLS}
            </div>
            {dayBlocks(week, d.day).map((b) => {
              const isSelected = sameBlock(b, selected);
              return (
                <WeekBlock
                  key={b.start}
                  block={b}
                  selected={isSelected}
                  resizing={isSelected && active?.kind === 'resize' ? active.edge : null}
                  idle={active === null}
                  onRemove={() => {
                    commit(removeBlock(weekRef.current, b));
                    onSelect(null);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
