import type { Metadata } from 'next';
import { AccentLink } from '@/components/site/SectionHead';
import { TimezoneBar } from '@/components/time/TimezoneBar';
import { Card } from '@/components/ui';
import { RAID_WEEK, SCHEDULE_ASIDES, SCHEDULE_HEAD } from '@/content/schedule';
import { cn } from '@/lib/cn';
import { MEMBER_LINKS } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'Raid schedule',
  description: 'Two progression nights a week plus an optional farm and alt night. Days and times to be announced. Attendance and sign-ups.',
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

      <section className={`${GUTTER} grid grid-cols-1 items-start gap-4 pb-20 lg:grid-cols-3`}>
        <Card className="flex flex-col gap-3 p-[26px]">
          <h2 className="text-[17px] font-semibold">{SCHEDULE_ASIDES.attendance.title}</h2>
          <p className="text-sm leading-[1.65] text-fg-2">{SCHEDULE_ASIDES.attendance.text}</p>
        </Card>
        <Card className="flex flex-col gap-3 p-[26px]">
          <h2 className="text-[17px] font-semibold">{SCHEDULE_ASIDES.signups.title}</h2>
          <p className="text-sm leading-[1.65] text-fg-2">{SCHEDULE_ASIDES.signups.text}</p>
          <AccentLink href={MEMBER_LINKS.calendar.href} className="self-start">
            {SCHEDULE_ASIDES.signups.linkLabel}
          </AccentLink>
        </Card>
        <div className="flex flex-col gap-3 rounded-card border border-teal-line bg-teal-wash p-[26px]">
          <h2 className="text-[17px] font-semibold">{SCHEDULE_ASIDES.availability.title}</h2>
          <p className="text-sm leading-[1.65] text-teal-text">{SCHEDULE_ASIDES.availability.text}</p>
        </div>
      </section>
    </>
  );
}
