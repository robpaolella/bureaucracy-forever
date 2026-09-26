'use client';

import { Tag } from '@/components/ui';
import { LOCKOUT_RESET, RAID_NIGHTS, WEEK_NOTE_PREFIX, WEEK_ORDER, type RaidNight } from '@/content/schedule';
import { cn } from '@/lib/cn';
import { formatClock, formatRangeShort, formatGuildClock, formatGuildRangeShort, minutesBetween, nextOccurrence, WEEKDAY_NAMES } from '@/lib/time';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';

function localRange(night: RaidNight, zone: string): string {
  const start = nextOccurrence(night.day, night.start);
  const end = new Date(start.getTime() + minutesBetween(night.start, night.end) * 60_000);
  return formatRangeShort(start, end, zone);
}

/**
 * Seven equal cells, Monday first. Raid nights: ink-800 fill, sand-dim border, guild
 * range large, "guild" small, local range in teal. Off nights read "Off". On mobile the
 * strip is a list and off days collapse to a 44px row (docs/04 § Raid schedule).
 */
export function WeekStrip() {
  const viewer = useViewerTimeZone();
  const byDay = new Map(RAID_NIGHTS.map((n) => [n.day, n]));

  const resetLocal = viewer ? formatClock(nextOccurrence(LOCKOUT_RESET.day, LOCKOUT_RESET.time), viewer.zone) : null;

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
                'flex min-h-[176px] flex-col gap-2.5 rounded-card border px-5 py-[26px]',
                night.optional ? 'border-line-strong bg-ink-850' : 'border-sand-dim bg-ink-800',
              )}
            >
              <span className={cn('text-[13px] font-semibold uppercase tracking-[0.1em]', night.optional ? 'text-fg-2' : 'text-sand')}>{short}</span>
              <span className="text-base font-semibold">{night.kind}</span>
              {night.optional && <Tag className="self-start px-2 py-[3px] text-label tracking-normal">Optional</Tag>}
              <div className="mt-auto flex flex-col gap-1">
                <span className="tabular text-[15px] font-semibold">{formatGuildRangeShort(night.start, night.end)}</span>
                <span className="text-xs text-fg-3">guild</span>
                <span className="tabular text-sm text-teal">{viewer ? `${localRange(night, viewer.zone)} yours` : ' '}</span>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-[13px] text-fg-3">
        {WEEK_NOTE_PREFIX} {WEEKDAY_NAMES[LOCKOUT_RESET.day]} <span className="tabular">{formatGuildClock(LOCKOUT_RESET.time)}</span> guild time
        {resetLocal && (
          <>
            {' — '}
            <span className="tabular">{resetLocal}</span> your time
          </>
        )}
        .
      </p>
    </div>
  );
}
