'use client';

import { useId, useState } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { LOOT_HISTORY_LOADS as COPY } from '@/content/loot-admin';
import { GUILD_TIMEZONE } from '@/lib/config';

/** One load from the audit table; createdAt is an ISO instant. */
export type LoadView = { sourceName: string; officerName: string; createdAt: string; mode: string; added: number; removed: number };

const grid = 'grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_80px_90px] md:items-center md:gap-x-3';

/** "Sep 28, 9:02 PM PDT": the date in the viewer's zone, then LocalTime, with guild time on hover and focus. */
function When({ at }: { at: string }) {
  const zone = useViewerTimeZone()?.zone ?? GUILD_TIMEZONE;
  const date = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric' }).format(new Date(at));
  return (
    <span>
      {date},{' '}
      <LocalTime startsAt={at} durationMin={0} weekday="guild" className="text-[13px] font-normal text-fg-2" />
    </span>
  );
}

/** The toolbar's "Last loaded" line and its load history. Nothing on a table that was never loaded. */
export function LoadHistory({ loads }: { loads: LoadView[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (loads.length === 0) return null;
  const last = loads[0];
  return (
    <div className="flex basis-full flex-wrap items-center gap-x-3.5 border-t border-line-faint pt-3 text-[13px] text-fg-3">
      <span className="max-w-full [overflow-wrap:anywhere]">
        {COPY.lastLoaded} <b className="font-semibold text-fg-2">{last.sourceName}</b> {COPY.by} <b className="font-semibold text-fg-2">{last.officerName}</b> · <When at={last.createdAt} /> · {last.mode}
      </span>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center rounded-sm font-semibold text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <span className="border-b border-teal-dim pb-0.5">{open ? COPY.hide : COPY.show}</span>
      </button>
      <div id={listId} hidden={!open} className="basis-full">
        <ul aria-label={COPY.listLabel} className="mt-1 w-full">
          <li aria-hidden="true" className={`${grid} hidden pb-2 text-label font-semibold uppercase tracking-[0.12em] text-fg-3 md:grid`}>
            {COPY.columns.map((c, i) => <span key={c} className={i === 4 ? 'text-right' : undefined}>{c}</span>)}
          </li>
          {loads.map((load, i) => (
            <li key={`${load.createdAt}-${i}`} className={`${grid} border-t border-line-faint py-2 text-fg-2`}>
              <span className="col-span-full break-words text-fg [overflow-wrap:anywhere] md:col-span-1">{load.sourceName}</span>
              <span>{load.officerName}</span>
              <span><When at={load.createdAt} /></span>
              <span>{COPY.mode(load.mode)}</span>
              <span className="tabular-nums md:text-right">{COPY.changes(load.added, load.removed)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
