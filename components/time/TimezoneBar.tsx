'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { GUILD_TIMEZONE } from '@/lib/config';
import { formatUtcOffset, zoneAbbreviation } from '@/lib/time';
import { TimezoneDialog } from './TimezoneDialog';
import { useViewerTimeZone } from './useViewerTimeZone';

const LABEL = 'text-label font-semibold uppercase';

/**
 * The canonical dual-time block (docs/04 § Raid schedule): guild zone in sand, the
 * viewer's zone in teal with a Detected / Chosen pill, and a button to override.
 * Reused at the top of the availability pages.
 */
export function TimezoneBar() {
  const viewer = useViewerTimeZone();
  const [open, setOpen] = useState(false);
  // The instant the abbreviations and offsets are read at. Frozen for the component's
  // life: a page left open across a DST change shows the old offset until reload, which
  // is a deliberate trade against re-rendering every tick.
  const now = useMemo(() => new Date(), []);

  const guild = `${GUILD_TIMEZONE} · ${zoneAbbreviation(now, GUILD_TIMEZONE)} (${formatUtcOffset(now, GUILD_TIMEZONE)})`;
  const yours = viewer ? `${viewer.zone} · ${zoneAbbreviation(now, viewer.zone)} (${formatUtcOffset(now, viewer.zone)})` : 'Detecting…';

  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-ink-850 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-[26px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-12 sm:gap-y-4">
        <div className="flex flex-col gap-[5px]">
          <span className={`${LABEL} text-sand`}>Guild time</span>
          <span className="tabular text-base font-semibold">{guild}</span>
        </div>
        <div className="hidden h-[38px] w-px bg-line sm:block" aria-hidden />
        <div className="flex flex-col gap-[5px]">
          <span className={`${LABEL} text-teal`}>Your time</span>
          <span className="tabular text-base font-semibold">{yours}</span>
        </div>
        {viewer && (
          <span className="self-start rounded-tag border border-teal-dim bg-teal-wash px-2.5 py-[5px] text-label font-semibold uppercase tracking-[0.08em] text-teal sm:self-center">
            {viewer.source === 'chosen' ? 'Chosen' : 'Detected'}
          </span>
        )}
      </div>
      <Button variant="secondary" size="sm" className="self-start bg-transparent px-[18px] lg:self-center" onClick={() => setOpen(true)}>
        Use a different timezone
      </Button>

      <TimezoneDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
