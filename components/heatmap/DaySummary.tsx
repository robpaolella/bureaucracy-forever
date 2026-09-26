'use client';

import { useState } from 'react';
import { fmtSlot, SLOTS, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { heatStep, type Heatmap } from '@/lib/heatmap';
import { HEAT_BG } from './HeatGrid';
import { InspectorBody } from './Inspector';

type Props = { heat: Heatmap; days: WeekDay[]; offsetSlots: number };

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      {dir === 'left' ? <path d="M9 2L4 7l5 5" /> : <path d="M5 2l5 5-5 5" />}
    </svg>
  );
}

/**
 * The phone replacement for the heatmap (docs/05 § Officer view § Mobile): seven rows,
 * each with a 48-block heat strip and the day's peak, and a single-day column with
 * tap-to-inspect once a row is chosen.
 */
export function DaySummary({ heat, days, offsetSlots }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);

  if (open !== null) {
    const day = days[open];
    const step = (delta: number) => {
      setOpen((open + delta + 7) % 7);
      setSlot(null);
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-card border border-line bg-ink-850 px-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous day" className="flex h-11 w-11 items-center justify-center text-fg-2 hover:text-fg">
            <Chevron dir="left" />
          </button>
          <button type="button" onClick={() => setOpen(null)} className="flex min-h-11 flex-col items-center justify-center px-4 hover:text-teal">
            <span className="text-[15px] font-semibold">{day.longName}</span>
            <span className="text-[11px] text-fg-3">{day.date} · tap to see the week</span>
          </button>
          <button type="button" onClick={() => step(1)} aria-label="Next day" className="flex h-11 w-11 items-center justify-center text-fg-2 hover:text-fg">
            <Chevron dir="right" />
          </button>
        </div>
        {slot !== null && (
          <div className="rounded-card border border-line-strong bg-ink-800 px-[18px] py-4">
            <InspectorBody day={day} slot={slot} cell={heat.cells[open][slot]} members={heat.members} memberCount={heat.memberCount} offsetSlots={offsetSlots} />
          </div>
        )}
        <p className="text-xs text-fg-3">Tap a half-hour to see who is free.</p>
        <ol className="overflow-hidden rounded-card border border-line bg-ink-900">
          {Array.from({ length: SLOTS }, (_, s) => {
            const cell = heat.cells[open][s];
            const onHour = s % 2 === 0;
            return (
              <li key={s} className={cn('flex h-[34px] items-stretch border-b', onHour ? 'border-line-faint' : 'border-line-hairline')}>
                <span className="tabular flex w-[76px] shrink-0 items-center pl-3 text-[11px] text-fg-muted">{onHour ? fmtSlot(s) : ''}</span>
                <button
                  type="button"
                  aria-label={`${day.name} ${fmtSlot(s)}, ${cell.total} available`}
                  aria-pressed={slot === s}
                  onClick={() => setSlot(s)}
                  className={cn('tabular flex flex-1 items-center justify-end border-l border-line-faint pr-3 text-[12px] font-semibold', HEAT_BG[heatStep(cell.total)], slot === s && 'outline outline-1 -outline-offset-1 outline-teal')}
                >
                  {cell.total > 0 ? cell.total : ''}
                </button>
                <span className="tabular flex w-[76px] shrink-0 items-center justify-end border-l border-line-faint pr-3 text-[11px] text-fg-3">{onHour ? fmtSlot(s + offsetSlots) : ''}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-line-faint overflow-hidden rounded-card border border-line bg-ink-900">
      {days.map((d) => {
        const peak = heat.cells[d.day].reduce((best, c) => Math.max(best, c.total), 0);
        return (
          <li key={d.day}>
            <button type="button" onClick={() => setOpen(d.day)} className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-850" aria-label={`${d.longName} ${d.date}, peak ${peak} available. Open the day.`}>
              <span className="flex w-[52px] shrink-0 flex-col">
                <span className={cn('text-[13px] font-semibold', d.isToday ? 'text-sand' : 'text-fg')}>{d.name}</span>
                <span className="text-[10px] text-fg-3">{d.date}</span>
              </span>
              <span className="flex flex-1 gap-px" aria-hidden>
                {heat.cells[d.day].map((c, s) => (
                  <span key={s} className={cn('h-4 flex-1', HEAT_BG[heatStep(c.total)])} />
                ))}
              </span>
              <span className="tabular w-8 shrink-0 text-right text-sm font-semibold text-teal">{peak}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
