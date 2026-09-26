'use client';

import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import type { RaidNight } from '@/content/schedule';
import { formatRangeShort, minutesBetween, nextOccurrence } from '@/lib/time';

/** " · 6:00 – 9:00 PM yours": the officer's own clock beside the guild time (docs/01 § Time). */
export function NightsLocal({ night }: { night: RaidNight }) {
  const viewer = useViewerTimeZone();
  if (!viewer) return null;
  const start = nextOccurrence(night.day, night.start);
  const end = new Date(start.getTime() + minutesBetween(night.start, night.end) * 60_000);
  return <span className="text-teal-text"> · {formatRangeShort(start, end, viewer.zone)} yours</span>;
}
