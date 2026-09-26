'use client';

import { cellLabel, fmtSlot, SLOTS, slotKey, type Week, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { usePaintStroke } from './paint';

type Props = {
  week: Week;
  days: WeekDay[];
  offsetSlots: number;
  paintCell: (key: string) => void;
  onOpenDay: (day: WeekDay) => void;
};

export const FILL: Record<string, string> = {
  available: 'bg-slot-available',
  'if-needed': 'bg-slot-ifNeeded',
};

/**
 * The desktop grid (docs/05 § The grid): 92px gutters, a 46px header, 48 rows of 19px.
 * Cells are real buttons with "Tue 8:30 PM" labels; they are the one exception to the
 * 44px rule, and the day headers open the keyboard alternative.
 */
export function WeekGrid({ week, days, offsetSlots, paintCell, onOpenDay }: Props) {
  const stroke = usePaintStroke(paintCell);

  return (
    <div
      className="select-none overflow-hidden rounded-card border border-line bg-ink-900 [touch-action:none]"
      onPointerDown={stroke.onPointerDown}
      onPointerMove={stroke.onPointerMove}
      role="grid"
      aria-label="Weekly availability"
      aria-rowcount={SLOTS}
    >
      <div className="flex h-[46px] items-stretch border-b border-line bg-ink-850" role="row">
        <div className="flex w-[92px] shrink-0 items-center pl-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-teal" role="columnheader">
          Yours
        </div>
        {days.map((d) => (
          <div key={d.day} className="flex flex-1 basis-0 border-l border-line-faint" role="columnheader">
            <button
              type="button"
              onClick={() => onOpenDay(d)}
              aria-haspopup="dialog"
              aria-label={`${d.longName} ${d.date}: set hours from a list`}
              className="flex h-full w-full flex-col justify-center gap-0.5 pl-3 text-left transition-colors duration-[120ms] hover:bg-ink-800"
            >
              <span className={cn('text-[13px] font-semibold', d.isToday ? 'text-sand' : 'text-fg')}>{d.name}</span>
              <span className="text-[11px] text-fg-3">{d.date}</span>
            </button>
          </div>
        ))}
        <div className="flex w-[92px] shrink-0 items-center justify-end border-l border-line-faint pr-3.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sand" role="columnheader">
          Server
        </div>
      </div>

      {Array.from({ length: SLOTS }, (_, slot) => {
        const onHour = slot % 2 === 0;
        const line = onHour ? 'border-line-faint' : 'border-line-hairline';
        return (
          <div key={slot} className="flex h-[19px] items-stretch" role="row">
            <div className={cn('tabular flex w-[92px] shrink-0 items-center border-b pl-3.5 text-[10px] text-fg-muted', line)} role="rowheader">
              {onHour ? fmtSlot(slot) : ''}
            </div>
            {days.map((d) => {
              const key = slotKey(d.day, slot);
              const state = week[key];
              return (
                <button
                  key={key}
                  type="button"
                  data-key={key}
                  role="gridcell"
                  aria-label={cellLabel(d.day, slot)}
                  aria-pressed={state ? true : false}
                  title={state === 'available' ? 'Available' : state === 'if-needed' ? 'If needed' : undefined}
                  className={cn(
                    'flex-1 basis-0 cursor-crosshair border-b border-l border-l-line-faint p-0 hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-teal',
                    line,
                    state ? FILL[state] : 'bg-slot-empty',
                  )}
                />
              );
            })}
            <div className={cn('tabular flex w-[92px] shrink-0 items-center justify-end border-b border-l border-l-line-faint pr-3.5 text-[10px] text-fg-3', line)}>
              {onHour ? fmtSlot(slot + offsetSlots) : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
