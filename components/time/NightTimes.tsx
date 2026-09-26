'use client';

import type { RaidNight } from '@/content/schedule';
import { formatClock, formatGuildRange, nextOccurrence } from '@/lib/time';
import { useViewerTimeZone } from './useViewerTimeZone';

/**
 * A raid night's times, twice: the guild range large, then "server · 6:00 PM yours".
 * The local value is computed from the night's next real occurrence, so DST is right.
 * Shown even when the viewer is in the guild zone: docs/01 says never render a bare time.
 * Layout from Home.html; the Schedule page's timezone bar is a separate component.
 */
export function NightTimes({ night }: { night: RaidNight }) {
  const viewer = useViewerTimeZone();
  const local = viewer ? formatClock(nextOccurrence(night.day, night.start), viewer.zone) : null;

  return (
    <div className="flex flex-col gap-1 text-right">
      <span className="tabular text-[15px] font-semibold">{formatGuildRange(night.start, night.end)}</span>
      <span className="text-xs text-fg-3">
        server
        {local && (
          <>
            {' · '}
            <span className="tabular">{local}</span> yours
          </>
        )}
      </span>
    </div>
  );
}
