'use client';

import { Tag } from '@/components/ui';
import { LOCKOUT_RESET, RAID_NIGHTS, WEEK_NOTE_PREFIX, WEEK_ORDER } from '@/content/schedule';
import { LocalTime } from '@/components/time/LocalTime';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { cn } from '@/lib/cn';
import { minutesBetween, nextOccurrence, WEEKDAY_NAMES, zonedParts } from '@/lib/time';

/**
 * Seven equal cells, Monday first. Raid nights: ink-800 fill, sand-dim border, the night's
 * next occurrence in the viewer's time with guild time on hover, tap and focus (LocalTime).
 * The weekday label stays the guild's; LocalTime names the viewer's day when it differs.
 * Off nights read "Off". On mobile the strip is a list and off days collapse to a 44px row
 * (docs/04 § Raid schedule).
 */
export function WeekStrip() {
  const viewer = useViewerTimeZone();
  const byDay = new Map(RAID_NIGHTS.map((n) => [n.day, n]));
  const resetAt = nextOccurrence(LOCKOUT_RESET.day, LOCKOUT_RESET.time);
  // When the reset falls on another day for the viewer, LocalTime names that day itself.
  const resetDay = viewer && zonedParts(resetAt, viewer.zone).weekday !== LOCKOUT_RESET.day ? '' : `${WEEKDAY_NAMES[LOCKOUT_RESET.day]} `;

  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-7" aria-label="Raid week">
        {WEEK_ORDER.map((day) => {
          const night = byDay.get(day);
          const short = WEEKDAY_NAMES[day].slice(0, 3);
          if (!night) {
            return (
              <li
                key={day}
                className="flex min-h-11 items-center justify-between rounded-card border border-line bg-ink-850 px-5 py-3 md:min-h-[176px] md:flex-col md:items-start md:justify-start md:gap-2.5 md:px-5 md:py-[26px]"
              >
                <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-fg-3">{short}</span>
                <span className="text-sm text-fg-3">Off</span>
              </li>
            );
          }
          return (
            <li
              key={day}
              className={cn(
                'flex flex-col gap-2.5 rounded-card border px-5 py-[26px] md:min-h-[176px]',
                night.optional ? 'border-line-strong bg-ink-850' : 'border-sand-dim bg-ink-800',
              )}
            >
              <span className={cn('text-[13px] font-semibold uppercase tracking-[0.1em]', night.optional ? 'text-fg-2' : 'text-sand')}>{short}</span>
              <span className="text-base font-semibold">{night.kind}</span>
              {night.optional && <Tag className="self-start px-2 py-[3px] text-label tracking-normal">Optional</Tag>}
              <LocalTime
                startsAt={nextOccurrence(night.day, night.start).toISOString()}
                durationMin={minutesBetween(night.start, night.end)}
                className="mt-auto text-[15px]"
              />
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-fg-3">
        {WEEK_NOTE_PREFIX} {resetDay}
        <LocalTime startsAt={resetAt.toISOString()} durationMin={0} className="text-[13px] font-normal text-fg-2" />.
      </p>
    </div>
  );
}
