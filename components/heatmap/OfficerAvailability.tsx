'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton } from '@/components/ui';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { guildOffsetSlots, weekDays, weekStart } from '@/lib/availability';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { Heatmap, HeatmapMember } from '@/lib/heatmap';
import { NUDGE_LABEL, NUDGE_PENDING, OFFICER_AVAILABILITY_HEAD } from '@/content/availability';
import { DaySummary } from './DaySummary';
import { HEAT_BG, HeatGrid } from './HeatGrid';
import { NotSubmitted } from './NotSubmitted';
import { WindowFinder } from './WindowFinder';

type Props = {
  memberCount: number;
  submitted: number;
  notSubmitted: HeatmapMember[];
};

/** The last fetch that settled, and for which zone and attempt; loading is derived from the mismatch. */
type Settled = { zone: string; attempt: number; heat: Heatmap | null };

/**
 * The officer availability page body (docs/05 § Officer view). The roster count and the
 * not-submitted list come from the server; the stacked grid is fetched for the viewer's
 * zone once it is known, since the projection depends on it.
 */
export function OfficerAvailability({ memberCount, submitted, notSubmitted }: Props) {
  const viewer = useViewerTimeZone();
  const zone = viewer?.zone ?? GUILD_TIMEZONE;
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    if (!viewer) return;
    const controller = new AbortController();
    const wanted = { zone: viewer.zone, attempt };
    fetch(`/api/availability/heatmap?tz=${encodeURIComponent(viewer.zone)}`, { signal: controller.signal, credentials: 'same-origin' })
      .then((r) => (r.ok ? (r.json() as Promise<Heatmap>) : Promise.reject(new Error(String(r.status)))))
      .then((heat) => setSettled({ ...wanted, heat }))
      .catch(() => {
        if (!controller.signal.aborted) setSettled({ ...wanted, heat: null });
      });
    return () => controller.abort();
  }, [viewer, attempt]);

  const current = settled && viewer && settled.zone === viewer.zone && settled.attempt === attempt ? settled : null;
  const status: 'loading' | 'error' | 'ready' = !current ? 'loading' : current.heat ? 'ready' : 'error';
  const heat = current?.heat ?? null;

  const days = useMemo(() => weekDays(now, zone), [now, zone]);
  const offsetSlots = useMemo(() => guildOffsetSlots(weekStart(now, zone), zone), [now, zone]);
  const weekLabel = useMemo(() => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: zone }).format(weekStart(now, zone)), [now, zone]);
  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="flex flex-col gap-3">
          <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{OFFICER_AVAILABILITY_HEAD.eyebrow}</span>
          <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{OFFICER_AVAILABILITY_HEAD.title}</h1>
          <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{OFFICER_AVAILABILITY_HEAD.lede}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5 rounded-control border border-line bg-ink-850 px-[18px] py-3">
            <span className="text-label font-semibold uppercase text-fg-3">Submitted</span>
            <span className="tabular text-base font-semibold">
              {submitted} of {memberCount}
            </span>
          </div>
          <Button variant="secondary" disabled title={NUDGE_PENDING}>
            {NUDGE_LABEL}
          </Button>
        </div>
      </section>

      <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[17px] font-semibold">Week of {weekLabel}</h2>
            <div className="flex items-center gap-2.5 text-xs text-fg-3" aria-label={`Colour scale from 0 to ${memberCount} available`}>
              <span>0</span>
              <span className="flex gap-[3px]" aria-hidden>
                {HEAT_BG.map((bg) => (
                  <span key={bg} className={`h-3 w-[22px] border border-line ${bg}`} />
                ))}
              </span>
              <span>{memberCount} available</span>
            </div>
          </div>

          {status === 'error' && (
            <div role="alert" className="flex flex-col gap-3 rounded-card border border-stop-line bg-stop-wash px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>Couldn&apos;t load the roster&apos;s availability.</span>
              <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Retry
              </Button>
            </div>
          )}
          {status === 'loading' && (
            <div className="flex flex-col gap-1 rounded-card border border-line bg-ink-900 p-3" aria-busy aria-label="Loading the heatmap">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} height={14} width={`${60 + ((i * 17) % 40)}%`} />
              ))}
            </div>
          )}
          {heat && (
            <>
              <div className="hidden lg:block">
                <HeatGrid heat={heat} days={days} offsetSlots={offsetSlots} />
              </div>
              <div className="lg:hidden">
                <DaySummary heat={heat} days={days} offsetSlots={offsetSlots} />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <WindowFinder heat={heat} days={days} offsetSlots={offsetSlots} />
          <NotSubmitted members={notSubmitted} />
        </div>
      </section>
    </div>
  );
}
