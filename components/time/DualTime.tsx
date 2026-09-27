'use client';

import { GUILD_TIMEZONE } from '@/lib/config';
import { cn } from '@/lib/cn';
import { formatClock, formatRange, zoneAbbreviation } from '@/lib/time';
import { useViewerTimeZone } from './useViewerTimeZone';

type Props = {
  /** ISO instant. */
  startsAt: string;
  /** 0 renders a single instant ("8:00 PM") instead of a range. */
  durationMin: number;
  className?: string;
};

/**
 * The dual time line for an absolute instant (docs/01 § Time): the guild range in sand
 * weight, then "guild · 6:00 – 9:00 PM yours" in the viewer's zone once it is known.
 * Shown even when the viewer is in the guild zone: never render a bare time.
 */
export function DualTime({ startsAt, durationMin, className }: Props) {
  const viewer = useViewerTimeZone();
  const start = new Date(startsAt);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const text = (zone: string) => (durationMin > 0 ? formatRange(start, end, zone) : formatClock(start, zone));
  return (
    <span className={cn('tabular text-sm text-fg-2', className)}>
      <span className="font-semibold text-fg">{text(GUILD_TIMEZONE)}</span>{' '}
      <span className="text-fg-3">guild{viewer ? ` (${zoneAbbreviation(start, GUILD_TIMEZONE)})` : ''}</span>
      {viewer && (
        <>
          <span className="text-fg-3"> · </span>
          <span className="text-teal-text">{text(viewer.zone)} yours</span>
        </>
      )}
    </span>
  );
}
