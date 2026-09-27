'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button } from '@/components/ui';
import { monthCells, monthLabel, shiftMonth } from '@/lib/calendar-grid';
import { cn } from '@/lib/cn';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { RaidCard } from '@/lib/raids';
import { formatClockShort, zonedParts } from '@/lib/time';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * SYNC-SPEC §9.4: a month grid whose chips read `short · time` in the viewer's zone, with a
 * sand edge when the viewer has answered. Days follow the viewer's calendar.
 */
export function MonthGrid({ raids, now }: { raids: RaidCard[]; now: Date }) {
  const viewer = useViewerTimeZone();
  const zone = viewer?.zone ?? GUILD_TIMEZONE;
  const start = zonedParts(now, zone);
  const [cursor, setCursor] = useState({ year: start.year, month: start.month });
  const rows = monthCells(cursor.year, cursor.month, raids, zone, now);
  return (
    <section className="flex flex-col gap-3" aria-label="Month">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-medium">{monthLabel(cursor.year, cursor.month)}</h2>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))} aria-label="Previous month">
            ←
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor({ year: start.year, month: start.month })}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))} aria-label="Next month">
            →
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-card border border-line bg-ink-900">
        <div className="grid grid-cols-7 border-b border-line text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3">
          {DAYS.map((d) => (
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
                {cell.raids.map((r) => (
                  <Link
                    key={r.id}
                    href={`/members/calendar/${r.id}`}
                    className={cn(
                      'block truncate rounded-tag border-l-2 bg-ink-800 px-1.5 py-1 text-[11px] font-semibold leading-tight hover:bg-ink-700',
                      r.mine ? 'border-sand' : 'border-transparent',
                      (r.cancelled || r.status === 'CANCELLED') && 'line-through opacity-60',
                    )}
                    title={r.name}
                  >
                    {r.short ?? r.name.split(' ')[0]} <span className="tabular font-normal text-fg-3">· {formatClockShort(new Date(r.startsAt), zone)}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
