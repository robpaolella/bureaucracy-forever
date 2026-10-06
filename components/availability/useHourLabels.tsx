'use client';

import { useMemo } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { SLOTS } from '@/lib/availability';

/**
 * The gutter's hour labels, one per even slot (null on the half-hours), in `zone` with guild
 * time on hover, tap and focus. A gutter row stands for every day, so it uses Monday's instant.
 * Built once per week and zone, so a paint stroke or the inspector moving does not re-render them.
 */
export function useHourLabels(zone: string, slotAt: (day: number, slot: number) => string, className: string) {
  return useMemo(
    () =>
      Array.from({ length: SLOTS }, (_, slot) =>
        slot % 2 === 0 ? <LocalTime key={slot} dense zone={zone} weekday="never" startsAt={slotAt(0, slot)} durationMin={0} className={className} /> : null,
      ),
    [zone, slotAt, className],
  );
}
