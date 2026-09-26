import type { Metadata } from 'next';
import { RunOfNight } from '@/components/schedule/RunOfNight';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { AccentLink } from '@/components/site/SectionHead';
import { TimezoneBar } from '@/components/time/TimezoneBar';
import { Card } from '@/components/ui';
import { RUN_OF_NIGHT, SCHEDULE_ASIDES, SCHEDULE_HEAD } from '@/content/schedule';
import { MEMBER_LINKS } from '@/lib/nav';

export const metadata: Metadata = {
  title: 'Raid schedule — Bureaucracy',
  description: 'Three raid nights a week, shown in guild time and yours. How a night runs, attendance and sign-ups.',
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
        <WeekStrip />
      </section>

      <section className={`${GUTTER} grid grid-cols-1 items-start gap-10 pb-20 lg:grid-cols-[minmax(0,1fr)_420px]`}>
        <div className="flex flex-col gap-[22px]">
          <h2 className="font-display text-[28px] font-medium leading-[1.1] md:text-[34px]">{RUN_OF_NIGHT.title}</h2>
          <RunOfNight />
        </div>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3 p-[26px]">
            <h3 className="text-[17px] font-semibold">{SCHEDULE_ASIDES.attendance.title}</h3>
            <p className="text-sm leading-[1.65] text-fg-2">{SCHEDULE_ASIDES.attendance.text}</p>
          </Card>
          <Card className="flex flex-col gap-3 p-[26px]">
            <h3 className="text-[17px] font-semibold">{SCHEDULE_ASIDES.signups.title}</h3>
            <p className="text-sm leading-[1.65] text-fg-2">{SCHEDULE_ASIDES.signups.text}</p>
            <AccentLink href={MEMBER_LINKS.calendar.href} className="self-start">
              {SCHEDULE_ASIDES.signups.linkLabel}
            </AccentLink>
          </Card>
          <div className="flex flex-col gap-3 rounded-card border border-teal-line bg-teal-wash p-[26px]">
            <h3 className="text-[17px] font-semibold">{SCHEDULE_ASIDES.availability.title}</h3>
            <p className="text-sm leading-[1.65] text-teal-text">{SCHEDULE_ASIDES.availability.text}</p>
          </div>
        </div>
      </section>
    </>
  );
}
