import type { Metadata } from 'next';
import { TimezoneBar } from '@/components/time/TimezoneBar';
import { Card } from '@/components/ui';
import { RAID_WEEK, SCHEDULE_ASIDES, SCHEDULE_HEAD } from '@/content/schedule';
import { cn } from '@/lib/cn';
import { SITE_NAME } from '@/lib/config';

const TITLE = 'Raid schedule';
const DESCRIPTION = 'Two progression nights a week, plus an optional night for farm and alt runs. Attendance, sign-ups and loot.';

/** Root layout's openGraph/twitter are whole-object overrides, not merged: repeat siteName/locale/card here too. */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_US', title: TITLE, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

const GUTTER = 'px-4 md:px-gutter';

export default function SchedulePage() {
  return (
    <>
      <section className={`${GUTTER} flex flex-col gap-6 pb-11 pt-16 md:pt-20`}>
        <span className="font-eyebrow text-eyebrow font-semibold uppercase tracking-[0.32em] text-sand">{SCHEDULE_HEAD.eyebrow}</span>
        <h1 className="font-display text-[40px] font-medium leading-[1.04] tracking-[-0.025em] md:text-[60px]">{SCHEDULE_HEAD.title}</h1>
        <p className="max-w-[640px] text-[17px] leading-[1.7] text-fg-2">{SCHEDULE_HEAD.lede}</p>
      </section>

      <section className={`${GUTTER} pb-11`}>
        <TimezoneBar />
      </section>

      <section className={`${GUTTER} pb-14`}>
        {/* Pre-launch stand-in for the week strip: the slots are known, the days and times are not. */}
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Raid week">
          {RAID_WEEK.map((slot) => (
            <li
              key={slot.day}
              className={cn(
                'flex flex-col gap-2.5 rounded-card border px-5 py-[26px]',
                slot.optional ? 'border-line-strong bg-ink-850' : 'border-sand-dim bg-ink-800',
              )}
            >
              <span className={cn('text-[13px] font-semibold uppercase tracking-[0.1em]', slot.optional ? 'text-fg-2' : 'text-sand')}>{slot.day}</span>
              <span className="text-base font-semibold">{slot.kind}</span>
              <span className="mt-3 text-[15px] font-semibold">TBD</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${GUTTER} pb-20`}>
        <Card className="px-[26px] py-0">
          <dl className="flex flex-col">
            {SCHEDULE_ASIDES.map((row) => (
              <div key={row.title} className="flex flex-col gap-2 border-t border-line-faint py-[22px] first:border-t-0 md:grid md:grid-cols-[200px_minmax(0,1fr)] md:items-baseline md:gap-6">
                <dt className="text-[13px] font-semibold uppercase tracking-[0.1em] text-sand">{row.title}</dt>
                <dd className="text-[15px] leading-[1.65] text-fg-2">{row.text}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </section>
    </>
  );
}
