'use client';

import { useMemo } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { SLOTS } from '@/lib/availability';

/**
 * The gutter's hour labels, one per even slot (null on the half-hours), in `zone` with guild
 * time on hover, tap and focus. A gutter row stands for every day, so it uses Monday's instant.
 * Labels sit two rows apart, so the hit area is capped at two rows to stay off its neighbours.
 * Built once per week and zone, so a paint stroke or the inspector moving does not re-render them.
 */
export function useHourLabels(zone: string, slotAt: (day: number, slot: number) => string, className: string, rowHeight: number) {
  return useMemo(
    () =>
      Array.from({ length: SLOTS }, (_, slot) =>
        slot % 2 === 0 ? <LocalTime key={slot} dense zone={zone} weekday="never" startsAt={slotAt(0, slot)} durationMin={0} className={className} hitHeight={Math.min(44, rowHeight * 2)} /> : null,
      ),
    [zone, slotAt, className, rowHeight],
  );
}
