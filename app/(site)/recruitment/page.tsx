import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ApplicationForm } from '@/components/recruitment/ApplicationForm';
import { NeedsTable } from '@/components/recruitment/NeedsTable';
import { AccentLink, EYEBROW } from '@/components/site/SectionHead';
import { ButtonLink, Card } from '@/components/ui';
import { EXPECTATIONS, NEED_LABEL, NEEDS_SECTION, NEXT_STEPS, RECRUITMENT_HEAD } from '@/content/recruitment';
import { DISCORD_INVITE_URL } from '@/lib/config';
import { getSession } from '@/lib/session';

export const metadata: Metadata = {
  title: 'Recruitment — Bureaucracy',
  description: 'Open needs by class and role, what we expect of a raider, and the application form.',
};

const GUTTER = 'px-4 md:px-gutter';

const LEGEND = [
  { status: 'high', dot: 'bg-ok' },
  { status: 'medium', dot: 'bg-warn' },
  { status: 'closed', dot: 'bg-fg-3' },
] as const;

export default async function RecruitmentPage() {
  const session = await getSession();

  return (
    <>
      <section className={`${GUTTER} grid grid-cols-1 items-end gap-8 pb-12 pt-16 md:pt-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16`}>
        <div className="flex flex-col gap-6">
          <span className="font-eyebrow text-eyebrow font-semibold uppercase tracking-[0.32em] text-sand">{RECRUITMENT_HEAD.eyebrow}</span>
          <h1 className="font-display text-[40px] font-medium leading-[1.04] tracking-[-0.025em] md:text-[60px]">{RECRUITMENT_HEAD.title}</h1>
          <p className="max-w-[640px] text-[17px] leading-[1.7] text-fg-2">{RECRUITMENT_HEAD.lede}</p>
        </div>
        <Card className="flex flex-col gap-2.5">
          <span className="text-label font-semibold uppercase text-fg-3">{RECRUITMENT_HEAD.aside.label}</span>
          <span className="text-[15px] leading-[1.6] text-fg-2">{RECRUITMENT_HEAD.aside.text}</span>
          <AccentLink href="#apply" className="mt-1 self-start">
            {RECRUITMENT_HEAD.aside.linkLabel}
          </AccentLink>
        </Card>
      </section>

      <section id="needs" className={`${GUTTER} flex flex-col gap-5 pb-[72px]`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-[28px] font-medium leading-[1.1] md:text-[34px]">{NEEDS_SECTION.title}</h2>
          <ul className="flex items-center gap-4 text-xs text-fg-3" aria-label="Legend">
            {LEGEND.map((l) => (
              <li key={l.status} className="inline-flex items-center gap-[7px]">
                <span aria-hidden className={`h-2 w-2 rounded-full ${l.dot}`} />
                {NEED_LABEL[l.status]}
              </li>
            ))}
          </ul>
        </div>
        <NeedsTable />
        <p className="text-xs text-fg-3">{NEEDS_SECTION.note}</p>
      </section>

      <section className={`${GUTTER} grid grid-cols-1 gap-10 pb-[72px] lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16`}>
        <div className="flex flex-col gap-3.5">
          <span className={EYEBROW}>{EXPECTATIONS.eyebrow}</span>
          <h2 className="font-display text-[30px] font-medium leading-[1.1] md:text-[38px]">{EXPECTATIONS.title}</h2>
          <p className="text-[15px] leading-[1.7] text-fg-3">{EXPECTATIONS.note}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {EXPECTATIONS.items.map((item, i) => (
            <Card key={i} className="flex flex-col gap-2">
              <span className="text-[17px] font-semibold">{item.title}</span>
              <span className="text-sm leading-[1.65] text-fg-2">{item.text}</span>
            </Card>
          ))}
        </div>
      </section>

      <section id="apply" className={`${GUTTER} grid grid-cols-1 items-start gap-10 pb-20 lg:grid-cols-[minmax(0,1fr)_380px]`}>
        <Suspense fallback={null}>
          <ApplicationForm discordHandle={session?.name.toLowerCase()} />
        </Suspense>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4 p-[26px]">
            <h3 className="text-[17px] font-semibold">{NEXT_STEPS.title}</h3>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-[1.6] text-fg-2">
              {NEXT_STEPS.steps.map((s, i) => (
                <li key={i}>
                  <span className="font-semibold text-fg">{s.lead}</span> — {s.text}
                </li>
              ))}
            </ol>
          </Card>
          <Card className="flex flex-col gap-2.5 p-[26px]">
            <h3 className="text-[17px] font-semibold">{NEXT_STEPS.social.title}</h3>
            <p className="text-sm leading-[1.65] text-fg-2">{NEXT_STEPS.social.text}</p>
          </Card>
          <div className="flex flex-col gap-2.5 rounded-card border border-teal-line bg-teal-wash p-[26px]">
            <h3 className="text-[17px] font-semibold">{NEXT_STEPS.questions.title}</h3>
            <p className="text-sm leading-[1.65] text-teal-text">{NEXT_STEPS.questions.text}</p>
            <ButtonLink href={DISCORD_INVITE_URL} variant="secondary" className="mt-1 border-teal-dim">
              {NEXT_STEPS.questions.button}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
