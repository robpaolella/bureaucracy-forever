import type { Metadata } from 'next';
import { ApplyButton } from '@/components/recruitment/ApplyModal';
import { NeedsTable } from '@/components/recruitment/NeedsTable';
import { EYEBROW } from '@/components/site/SectionHead';
import { ButtonLink, Card } from '@/components/ui';
import { APPLY_LINKS, EXPECTATIONS, NEED_LABEL, NEEDS_SECTION, NEXT_STEPS, QUESTIONS, RECRUITMENT_HEAD } from '@/content/recruitment';
import { getClassNeeds } from '@/lib/class-needs-data';
import { DISCORD_INVITE_URL, SITE_NAME } from '@/lib/config';

const TITLE = 'Recruitment';
const DESCRIPTION = 'See which classes and specs we need most, what we expect of every raider, and how to apply.';

/** Root layout's openGraph/twitter are whole-object overrides, not merged — repeat siteName/locale/card here too. */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: 'website', siteName: SITE_NAME, locale: 'en_US', title: `${TITLE} — ${SITE_NAME}`, description: DESCRIPTION },
  twitter: { card: 'summary_large_image', title: `${TITLE} — ${SITE_NAME}`, description: DESCRIPTION },
};

const GUTTER = 'px-4 md:px-gutter';

const LEGEND = [
  { status: 'high', dot: 'bg-ok' },
  { status: 'medium', dot: 'bg-warn' },
  { status: 'closed', dot: 'bg-fg-3' },
] as const;

/** Needs come from the database and refresh within a minute of an officer's edit. */
export const revalidate = 60;

export default async function RecruitmentPage() {
  const needs = await getClassNeeds();
  return (
    <>
      <section className={`${GUTTER} grid grid-cols-1 gap-8 pb-12 pt-16 md:pt-20 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-16`}>
        <div className="flex flex-col gap-6">
          <span className="font-eyebrow text-eyebrow font-semibold uppercase tracking-[0.32em] text-sand">{RECRUITMENT_HEAD.eyebrow}</span>
          <h1 className="font-display text-[40px] font-medium leading-[1.04] tracking-[-0.025em] md:text-[60px]">{RECRUITMENT_HEAD.title}</h1>
          <p className="max-w-[640px] text-[17px] leading-[1.7] text-fg-2">{RECRUITMENT_HEAD.lede}</p>
        </div>
        <Card className="flex flex-col gap-4">
          <span className="text-label font-semibold uppercase text-fg-3">{RECRUITMENT_HEAD.aside.label}</span>
          <span className="text-[15px] leading-[1.6] text-fg-2">{RECRUITMENT_HEAD.aside.text}</span>
          <div className="flex flex-col gap-3">
            <ApplyButton path={APPLY_LINKS.raider.path} size="lg" className="w-full font-bold">
              {APPLY_LINKS.raider.label}
            </ApplyButton>
            <ApplyButton path={APPLY_LINKS.social.path} size="lg" variant="secondary" className="w-full">
              {APPLY_LINKS.social.label}
            </ApplyButton>
          </div>
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
        <NeedsTable needs={needs} />
      </section>

      <section id="expectations" className={`${GUTTER} grid grid-cols-1 gap-10 pb-[72px] lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16`}>
        <div className="flex flex-col gap-3.5">
          <span className={EYEBROW}>{EXPECTATIONS.eyebrow}</span>
          <h2 className="font-display text-[30px] font-medium leading-[1.1] md:text-[38px]">{EXPECTATIONS.title}</h2>
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

      <section id="apply" className={`${GUTTER} flex flex-col gap-4 pb-20`}>
        <Card className="grid grid-cols-1 gap-8 p-6 md:p-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          <div className="flex flex-col gap-6">
            <h2 className="font-display text-[34px] font-medium leading-[1.1]">{APPLY_LINKS.title}</h2>
            <div className="flex flex-col gap-4">
              {[APPLY_LINKS.raider, APPLY_LINKS.social].map((link) => (
                <div key={link.path} className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-5">
                  <ApplyButton path={link.path} size="lg" variant={link.path === 'raider' ? 'primary' : 'secondary'} className={link.path === 'raider' ? 'w-full font-bold sm:w-[220px] sm:flex-none' : 'w-full sm:w-[220px] sm:flex-none'}>
                    {link.label}
                  </ApplyButton>
                  <p className="text-[15px] leading-[1.6] text-fg-2">{link.line}</p>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-fg-3">{APPLY_LINKS.note}</p>
          </div>
          <div className="flex flex-col gap-4 border-t border-line pt-6 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
            <h3 className="text-[17px] font-semibold">{NEXT_STEPS.title}</h3>
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-[1.6] text-fg-2">
              {NEXT_STEPS.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        </Card>
        <div className="flex flex-col gap-3.5 rounded-card border border-teal-line bg-teal-wash px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] leading-[1.6] text-teal-text">
            <span className="font-semibold text-fg">{QUESTIONS.title}</span> {QUESTIONS.text}
          </p>
          <ButtonLink href={DISCORD_INVITE_URL} variant="secondary" className="border-teal-dim">
            {QUESTIONS.button}
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
