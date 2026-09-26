'use client';

import { useId, useMemo, useState } from 'react';
import { Card, CONTROL, FIELD_LABEL } from '@/components/ui';
import { fmtSlot, type WeekDay } from '@/lib/availability';
import { cn } from '@/lib/cn';
import { HEAT_ROLES, type Heatmap, type HeatRole, type RoleCounts } from '@/lib/heatmap';
import { DEFAULT_MINIMA, findWindows, formatRoleMinima, topWindows, WINDOW_LENGTHS } from '@/lib/windows';
import { WINDOW_FINDER } from '@/content/availability';

type Props = { heat: Heatmap | null; days: WeekDay[]; offsetSlots: number };

const ROLE_LABEL: Record<HeatRole, string> = { tank: 'Min tanks', healer: 'Min healers', melee: 'Min melee', ranged: 'Min ranged' };
const LENGTH_LABEL: Record<(typeof WINDOW_LENGTHS)[number], string> = { 4: '2 hours', 6: '3 hours', 8: '4 hours' };

/**
 * docs/05 § Find raid windows. Three 44px length buttons, a 2×2 grid of minimums, and the
 * ranked results, recomputed on every change. The count in the header is the full count;
 * the list shows at most one window per day, five in all.
 */
export function WindowFinder({ heat, days, offsetSlots }: Props) {
  const [length, setLength] = useState<number>(6);
  const [minima, setMinima] = useState<RoleCounts>(DEFAULT_MINIMA);
  const baseId = useId();

  const all = useMemo(() => (heat ? findWindows(heat.cells, length, minima) : []), [heat, length, minima]);
  const shown = useMemo(() => topWindows(all), [all]);

  return (
    <Card accolade className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-2xl font-medium">{WINDOW_FINDER.title}</h2>
        <p className="text-small text-fg-2">{WINDOW_FINDER.lede}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span id={`${baseId}-len`} className={FIELD_LABEL}>
          Raid length
        </span>
        <div className="flex gap-2" role="radiogroup" aria-labelledby={`${baseId}-len`}>
          {WINDOW_LENGTHS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={length === l}
              onClick={() => setLength(l)}
              className={cn(
                'h-11 flex-1 rounded-control border text-sm font-semibold transition-colors duration-[120ms]',
                length === l ? 'border-teal bg-teal-wash' : 'border-line-strong bg-ink-800 hover:bg-ink-700',
              )}
            >
              {LENGTH_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {HEAT_ROLES.map((r) => (
          <div key={r} className="flex flex-col gap-1.5">
            <label htmlFor={`${baseId}-${r}`} className={FIELD_LABEL}>
              {ROLE_LABEL[r]}
            </label>
            <input
              id={`${baseId}-${r}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={minima[r]}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                setMinima((m) => ({ ...m, [r]: Number.isNaN(n) || n < 0 ? 0 : n }));
              }}
              className={cn(CONTROL, 'tabular h-11 px-3.5')}
            />
          </div>
        ))}
      </div>

      <div className="h-px bg-line" aria-hidden />

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h3 className={FIELD_LABEL}>Windows that work</h3>
          <span className="tabular text-xs text-fg-2" aria-live="polite">
            {heat ? `${all.length} found` : 'Loading…'}
          </span>
        </div>
        {heat && shown.length === 0 && (
          <p role="status" className="rounded-control border border-dashed border-line-strong px-4 py-6 text-center text-small text-fg-2">
            {WINDOW_FINDER.none}
          </p>
        )}
        {shown.length > 0 && (
          <ol className="flex flex-col gap-2">
            {shown.map((w) => {
              const day = days[w.day];
              return (
                <li key={`${w.day}:${w.start}`} className="flex items-center justify-between gap-3 rounded-control border border-line-strong bg-ink-800 px-4 py-3.5">
                  <div className="flex flex-col gap-[3px]">
                    <span className="tabular text-[15px] font-semibold">
                      {day.name} {fmtSlot(w.start)} – {fmtSlot(w.start + w.length)}
                    </span>
                    <span className="tabular text-[11px] text-fg-3">
                      {fmtSlot(w.start + offsetSlots)} – {fmtSlot(w.start + w.length + offsetSlots)} guild time
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-[3px]">
                    <span className="tabular text-base font-bold text-ok">{w.score}</span>
                    <span className="tabular text-[11px] text-fg-2">{formatRoleMinima(w.roles)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Card>
  );
}
