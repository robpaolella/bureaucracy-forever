'use client';

import type { RaidNight } from '@/content/schedule';
import { REALM_TIMEZONE } from '@/lib/config';
import { formatClock, formatRealmRange, nextOccurrence } from '@/lib/time';
import { useViewerTimeZone } from './useViewerTimeZone';

/**
 * A raid night's times, twice: the realm range large, then "server · 6:00 PM yours".
 * The local value is computed from the night's next real occurrence, so DST is right.
 * Layout from Home.html; the Schedule page's timezone bar is a separate component.
 */
export function NightTimes({ night }: { night: RaidNight }) {
  const zone = useViewerTimeZone();
  const local = zone && zone !== REALM_TIMEZONE ? formatClock(nextOccurrence(night.day, night.start), zone) : null;

  return (
    <div className="flex flex-col gap-1 text-right">
      <span className="tabular text-[15px] font-semibold">{formatRealmRange(night.start, night.end)}</span>
      <span className="text-xs text-fg-3">
        server
        {local && (
          <>
            {' · '}
            <span className="tabular">{local}</span> yours
          </>
        )}
        {zone === REALM_TIMEZONE && ' · your time'}
      </span>
    </div>
  );
}
