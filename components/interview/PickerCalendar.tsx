import { useEffect, useRef } from 'react';
import { INTERVIEW } from '@/content/interview';
import { cn } from '@/lib/cn';
import { formatLongDate, WEEKDAY_NAMES } from '@/lib/time';
import type { PickerDay } from './picker';

const { month: COPY } = INTERVIEW.pick;

const chevron = (d: 'l' | 'r') => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d === 'l' ? <path d="M9 2L4 7l5 5" /> : <path d="M5 2l5 5-5 5" />}
  </svg>
);

const Dot = ({ className }: { className?: string }) => <span aria-hidden className={cn('h-[5px] w-[5px] rounded-full bg-teal', className)} />;

/** What a day button says to a screen reader: the date, and how many hours are picked on it. */
export const dayName = (day: PickerDay, zone: string, picked: number) => INTERVIEW.pick.dayLabel(formatLongDate(new Date(day.starts[0]), zone), picked);

type Props = {
  days: PickerDay[];
  current: PickerDay;
  zone: string;
  /** Hours picked on each day, by day key. */
  picked: Map<number, number>;
  onPick: (day: PickerDay) => void;
};

/** One month of the window, as in the approved design: days with times are buttons, the rest are dimmed. */
export function MonthCalendar({ days, current, zone, picked, onPick, month, onMonth }: Props & { month: { year: number; month: number }; onMonth: (step: -1 | 1) => void }) {
  const months = new Set(days.map((d) => d.year * 12 + d.month));
  const index = month.year * 12 + month.month;
  const byKey = new Map(days.map((d) => [d.key, d]));
  const lead = new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
  const title = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(month.year, month.month - 1, 1)));
  const arrow = (step: -1 | 1, label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-disabled={!months.has(index + step)}
      onClick={() => months.has(index + step) && onMonth(step)}
      className="flex h-11 w-11 items-center justify-center rounded-full text-fg-3 aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
    >
      {chevron(step < 0 ? 'l' : 'r')}
    </button>
  );
  return (
    <div className="px-5 py-[22px]">
      <div className="mb-3 flex items-center justify-between">
        {arrow(-1, COPY.previous)}
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {arrow(1, COPY.next)}
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-1" role="group" aria-label={COPY.days}>
        {WEEKDAY_NAMES.map((w) => (
          <span key={w} aria-hidden className="pb-1.5 text-[11px] font-semibold text-fg-3">
            {w[0]}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {Array.from({ length: length }, (_, i) => {
          const n = i + 1;
          const day = byKey.get(month.year * 10_000 + month.month * 100 + n);
          const base = 'relative flex h-11 w-11 items-center justify-center rounded-full text-sm tabular';
          if (!day) {
            return (
              <span key={n} aria-hidden className={cn(base, 'text-fg-3 opacity-55')}>
                {n}
              </span>
            );
          }
          const count = picked.get(day.key) ?? 0;
          const selected = day.key === current.key;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={selected}
              aria-label={dayName(day, zone, count)}
              onClick={() => onPick(day)}
              className={cn(base, 'font-semibold transition-[filter] duration-[120ms] hover:brightness-125', selected ? 'bg-sand text-ink-950' : 'bg-ink-700 text-fg')}
            >
              {n}
              {count > 0 && <Dot className={cn('absolute bottom-[5px] left-1/2 -ml-[2.5px]', selected && 'bg-ink-950')} />}
            </button>
          );
        })}
      </div>
      <p className="mt-4 flex items-center gap-2 pl-2 text-xs text-fg-muted">
        <Dot />
        {COPY.legend}
      </p>
    </div>
  );
}

/** The phone's row of days, one chip each. */
export function DayStrip({ days, current, zone, picked, onPick }: Props) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  // The strip scrolls sideways: bring the chosen day into view when it changes (a zone switch can move it).
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [current.key]);
  return (
    <div role="group" aria-label={COPY.days} className="flex gap-2 overflow-x-auto border-t border-line-faint px-4 pb-3 pt-2 [scrollbar-width:none] min-[600px]:px-5">
      {days.map((day) => {
        const selected = day.key === current.key;
        const count = picked.get(day.key) ?? 0;
        return (
          <button
            key={day.key}
            ref={selected ? selectedRef : undefined}
            type="button"
            aria-pressed={selected}
            aria-label={dayName(day, zone, count)}
            onClick={() => onPick(day)}
            className={cn('flex h-16 w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-card border', selected ? 'border-sand bg-sand text-ink-950' : 'border-line-strong text-fg')}
          >
            <span aria-hidden className={cn('text-[11px] font-semibold', selected ? 'text-ink-950' : 'text-fg-3')}>
              {WEEKDAY_NAMES[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()].slice(0, 3)}
            </span>
            <span aria-hidden className="tabular text-base font-semibold">
              {day.day}
            </span>
            <Dot className={cn(selected && 'bg-ink-950', count === 0 && 'invisible')} />
          </button>
        );
      })}
    </div>
  );
}
