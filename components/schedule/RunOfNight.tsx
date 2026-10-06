'use client';

import { LocalTime } from '@/components/time/LocalTime';
import { RUN_OF_NIGHT } from '@/content/schedule';
import { nextOccurrence } from '@/lib/time';

const TH = 'border-b border-line px-[22px] py-3 text-left text-label font-semibold uppercase tracking-[0.12em]';

/**
 * Time / What happens. Each time is the viewer's, with guild time on hover, tap and focus
 * (LocalTime). A table on desktop; on mobile a stacked list with the time above each
 * description (docs/04 § Raid schedule). Neither wrapper hides overflow, so the last row's
 * guild-time popup isn't clipped: the corner cells carry the rounding instead.
 */
export function RunOfNight() {
  const rows = RUN_OF_NIGHT.rows.map((r) => ({ ...r, startsAt: nextOccurrence(RUN_OF_NIGHT.anchorDay, r.time).toISOString() }));

  return (
    <>
      <div className="hidden rounded-card border border-line md:block">
        <table className="w-full border-separate border-spacing-0 text-[15px] [&_tr:first-child>th:first-child]:rounded-tl-card [&_tr:first-child>th:last-child]:rounded-tr-card [&_tr:last-child>td:first-child]:rounded-bl-card [&_tr:last-child>td:last-child]:rounded-br-card">
          <thead>
            <tr className="bg-ink-850">
              <th scope="col" className={`${TH} text-sand`}>
                Time
              </th>
              <th scope="col" className={`${TH} text-fg-3`}>
                What happens
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {rows.map((r) => (
              <tr key={r.time} className="even:bg-ink-850">
                <td className="border-b border-line-faint px-[22px] py-4">
                  <LocalTime startsAt={r.startsAt} durationMin={0} className="text-[15px]" />
                </td>
                <td className="border-b border-line-faint px-[22px] py-4 text-fg-2">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="flex flex-col divide-y divide-line-faint rounded-card border border-line md:hidden">
        {rows.map((r) => (
          <li key={r.time} className="flex flex-col gap-2 px-5 py-4 first:rounded-t-card last:rounded-b-card even:bg-ink-850">
            <LocalTime startsAt={r.startsAt} durationMin={0} className="text-[15px]" />
            <span className="text-sm leading-relaxed text-fg-2">{r.text}</span>
          </li>
        ))}
      </ol>
    </>
  );
}
