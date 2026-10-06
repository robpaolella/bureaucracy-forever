'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button } from '@/components/ui';
import { monthCells, monthLabel, shiftMonth } from '@/lib/calendar-grid';
import { cn } from '@/lib/cn';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { RaidCard } from '@/lib/raids';
import { formatClockShort, viewerTime, zonedParts } from '@/lib/time';
import { MONTH } from '@/content/calendar';

/**
 * SYNC-SPEC §9.4: a month grid whose chips read `short · time` in the viewer's zone, with a
 * sand edge when the viewer has answered. Days follow the viewer's calendar. The chip's
 * title and accessible name carry the viewer's time, guild time and the state words, so the
 * grid is not the one place guild time is missing or a state is colour alone.
 */
export function MonthGrid({ raids, now }: { raids: RaidCard[]; now: Date }) {
  const viewer = useViewerTimeZone();
  const zone = viewer?.zone ?? GUILD_TIMEZONE;
  const start = zonedParts(now, zone);
  const [cursor, setCursor] = useState({ year: start.year, month: start.month });
  const rows = monthCells(cursor.year, cursor.month, raids, zone, now);
  return (
    <section className="flex flex-col gap-3" aria-label={MONTH.month}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium">{monthLabel(cursor.year, cursor.month)}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))} aria-label={MONTH.previous}>
            ←
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor({ year: start.year, month: start.month })}>
            {MONTH.today}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))} aria-label={MONTH.next}>
            →
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-ink-900">
        <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3">
          {MONTH.days.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {rows.map((week, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-line-faint last:border-b-0">
            {week.map((cell) => (
              <div key={cell.key} className={cn('flex min-h-[92px] flex-col gap-1 border-r border-line-faint p-1.5 last:border-r-0', !cell.inMonth && 'opacity-40')}>
                <span className={cn('tabular self-end text-xs', cell.today ? 'rounded-full bg-sand px-1.5 font-bold text-ink-950' : 'text-fg-3')}>{cell.day}</span>
                {cell.raids.map((r) => {
                  const start = new Date(r.startsAt);
                  const cancelled = r.cancelled || r.status === 'CANCELLED';
                  const both = viewerTime(start, 0, viewer?.zone ?? null).label;
                  const state = [cancelled && MONTH.cancelled, r.mine && MONTH.answered].filter(Boolean).join(', ');
                  return (
                    <Link
                      key={r.id}
                      href={`/members/calendar/${r.id}`}
                      className={cn(
                        'flex min-h-11 items-center truncate rounded-tag border-l-2 bg-ink-800 px-1.5 text-[11px] font-semibold leading-tight hover:bg-ink-700',
                        r.mine ? 'border-sand' : 'border-transparent',
                        cancelled && 'line-through opacity-60',
                      )}
                      title={`${r.name} · ${both}${state ? ` · ${state}` : ''}`}
                    >
                      <span className="truncate">
                        {r.short ?? r.name.split(' ')[0]} <span className="tabular font-normal text-fg-3">· {formatClockShort(start, zone)}</span>
                      </span>
                      <span className="sr-only">
                        {' '}
                        {r.name}, {both}
                        {state ? `, ${state}` : ''}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
