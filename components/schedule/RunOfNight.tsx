'use client';

import { RUN_OF_NIGHT } from '@/content/schedule';
import { formatClock, formatGuildClock, nextOccurrence } from '@/lib/time';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';

const TH = 'border-b border-line px-[22px] py-3 text-left text-label font-semibold uppercase tracking-[0.12em]';

/**
 * Guild time / Your time / What happens. A table on desktop; on mobile a stacked list with
 * both times side by side above each description (docs/04 § Raid schedule).
 */
export function RunOfNight() {
  const viewer = useViewerTimeZone();
  const rows = RUN_OF_NIGHT.rows.map((r) => ({
    ...r,
    guild: formatGuildClock(r.time),
    local: viewer ? formatClock(nextOccurrence(RUN_OF_NIGHT.anchorDay, r.time), viewer.zone) : null,
  }));

  return (
    <>
      <div className="hidden overflow-hidden rounded-card border border-line md:block">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr className="bg-ink-850">
              <th scope="col" className={`${TH} text-sand`}>
                Guild time
              </th>
              <th scope="col" className={`${TH} text-teal`}>
                Your time
              </th>
              <th scope="col" className={`${TH} text-fg-3`}>
                What happens
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {rows.map((r) => (
              <tr key={r.time} className="even:bg-ink-850">
                <td className="tabular border-b border-line-faint px-[22px] py-4 font-semibold">{r.guild}</td>
                <td className="tabular border-b border-line-faint px-[22px] py-4 text-fg-2">{r.local ?? '—'}</td>
                <td className="border-b border-line-faint px-[22px] py-4 text-fg-2">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="flex flex-col divide-y divide-line-faint overflow-hidden rounded-card border border-line md:hidden">
        {rows.map((r) => (
          <li key={r.time} className="flex flex-col gap-2 px-5 py-4 even:bg-ink-850">
            <div className="flex items-baseline gap-4">
              <span className="tabular text-[15px] font-semibold">
                {r.guild} <span className="text-label font-semibold uppercase tracking-[0.12em] text-sand">guild</span>
              </span>
              {r.local && (
                <span className="tabular text-[15px] text-fg-2">
                  {r.local} <span className="text-label font-semibold uppercase tracking-[0.12em] text-teal">yours</span>
                </span>
              )}
            </div>
            <span className="text-sm leading-relaxed text-fg-2">{r.text}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
