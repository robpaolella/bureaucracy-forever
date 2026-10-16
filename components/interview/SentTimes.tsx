'use client';

import { LocalTime } from '@/components/time/LocalTime';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { INTERVIEW } from '@/content/interview';
import { GUILD_TIMEZONE } from '@/lib/config';
import { countHours, timesByDay } from './state';

/** The times an applicant sent, by the viewer's own days; guild days until their zone is known. */
export function SentTimes({ slots }: { slots: string[] }) {
  const viewer = useViewerTimeZone();
  const days = timesByDay(slots, viewer?.zone ?? GUILD_TIMEZONE);
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-left text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{INTERVIEW.submitted.timesLabel(countHours(slots))}</p>
      <ul className="flex w-full flex-col divide-y divide-line-faint rounded-card border border-line bg-ink-900 text-left">
        {days.map(({ day, runs }) => (
          <li key={day} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="shrink-0 text-sm font-semibold text-fg sm:w-[150px]">{day}</span>
            <span className="flex flex-wrap gap-x-4 gap-y-1">
              {runs.map((run) => (
                <LocalTime key={run.start} startsAt={run.start} durationMin={run.minutes} weekday="guild" className="font-normal text-fg-2" />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
