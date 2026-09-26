'use client';

import { useRef, useState } from 'react';
import { fmtSlot, SLOTS, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { heatStep, type Heatmap } from '@/lib/heatmap';
import { NOBODY_SUBMITTED } from '@/content/availability';
import { InspectorBody, InspectorPopover, type InspectorTarget } from './Inspector';

type Props = { heat: Heatmap; days: WeekDay[]; offsetSlots: number };

export const HEAT_BG = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4', 'bg-heat-5'] as const;
const ROW = 17;
const GUTTER = 'w-[72px] shrink-0';

/**
 * The officer heatmap (docs/05 § Heatmap): the member grid's geometry at 17px rows and
 * 72px gutters, each cell filled from the six-step ramp. Cells are buttons with the count
 * in their label, so the numbers reach a screen reader and the keyboard; hover or focus
 * opens the inspector, leaving the grid closes it.
 */
export function HeatGrid({ heat, days, offsetSlots }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<InspectorTarget | null>(null);

  const show = (day: number, slot: number, el: HTMLElement) => {
    const grid = container.current;
    if (!grid) return;
    const g = grid.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setTarget({ day, slot, box: { top: b.top - g.top, left: b.left - g.left, width: b.width, height: b.height } });
  };

  const empty = heat.submitted === 0;

  return (
    <div
      ref={container}
      role="grid"
      aria-label="Roster availability, members available per half-hour"
      aria-rowcount={SLOTS}
      className="relative rounded-card border border-line bg-ink-900"
      onMouseLeave={() => setTarget(null)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setTarget(null)}
    >
      <div className="flex h-11 items-stretch rounded-t-card border-b border-line bg-ink-850" role="row">
        <div className={cn(GUTTER, 'flex items-center pl-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal')} role="columnheader">
          Yours
        </div>
        {days.map((d) => (
          <div key={d.day} className="flex flex-1 basis-0 flex-col justify-center gap-px border-l border-line-faint pl-2.5" role="columnheader">
            <span className={cn('text-[13px] font-semibold', d.isToday ? 'text-sand' : 'text-fg')}>{d.name}</span>
            <span className="text-[10px] text-fg-3">{d.date}</span>
          </div>
        ))}
        <div className={cn(GUTTER, 'flex items-center justify-end border-l border-line-faint pr-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-sand')} role="columnheader">
          Guild
        </div>
      </div>

      {Array.from({ length: SLOTS }, (_, slot) => {
        const onHour = slot % 2 === 0;
        const line = onHour ? 'border-line-faint' : 'border-line-hairline';
        return (
          <div key={slot} className="flex items-stretch" style={{ height: ROW }} role="row">
            <div className={cn(GUTTER, 'tabular flex items-center border-b pl-3 text-[10px] text-fg-muted', line)} role="rowheader">
              {onHour ? fmtSlot(slot) : ''}
            </div>
            {days.map((d) => {
              const cell = heat.cells[d.day][slot];
              return (
                <button
                  key={d.day}
                  type="button"
                  role="gridcell"
                  aria-label={`${d.name} ${fmtSlot(slot)}, ${cell.total} available`}
                  onMouseEnter={(e) => show(d.day, slot, e.currentTarget)}
                  onFocus={(e) => show(d.day, slot, e.currentTarget)}
                  className={cn(
                    'flex-1 basis-0 cursor-default border-b border-l border-l-line-faint p-0 hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-fg focus-visible:outline focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-teal',
                    line,
                    HEAT_BG[heatStep(cell.total)],
                  )}
                />
              );
            })}
            <div className={cn(GUTTER, 'tabular flex items-center justify-end border-b border-l border-l-line-faint pr-3 text-[10px] text-fg-3', line)} role="gridcell">
              {onHour ? fmtSlot(slot + offsetSlots) : ''}
            </div>
          </div>
        );
      })}

      {target && (
        <InspectorPopover target={target} gridHeight={44 + SLOTS * ROW}>
          <InspectorBody day={days[target.day]} slot={target.slot} cell={heat.cells[target.day][target.slot]} members={heat.members} memberCount={heat.memberCount} offsetSlots={offsetSlots} />
        </InspectorPopover>
      )}

      {empty && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <p role="status" className="max-w-[320px] rounded-card border border-line-strong bg-ink-850/95 px-6 py-5 text-center text-sm leading-relaxed text-fg-2">
            {NOBODY_SUBMITTED}
          </p>
        </div>
      )}
    </div>
  );
}
