import type { Metadata } from 'next';
import { LootToc } from '@/components/loot/LootToc';
import { AccentLink } from '@/components/site/SectionHead';
import { Card } from '@/components/ui';
import { LOOT_ASIDE, LOOT_FAQ, LOOT_HEAD, LOOT_SUMMARY, LOOT_TOC, LOOT_TRIALS, LOOT_WEIGH, LOOT_WHO } from '@/content/loot';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Loot rules — Bureaucracy',
  description: 'How loot is decided: who sits on council, how a drop is weighed, and what trials can expect.',
};

const GUTTER = 'px-4 md:px-gutter';
const PROSE = 'text-base leading-[1.75] text-fg-2';
const H2 = 'font-display text-[30px] font-medium leading-[1.15] md:text-[34px]';

export default function LootPage() {
  return (
    <>
      <section className={`${GUTTER} flex flex-col gap-[22px] pb-8 pt-16 md:pb-12 md:pt-20`}>
        <span className="font-eyebrow text-eyebrow font-semibold uppercase tracking-[0.32em] text-sand">{LOOT_HEAD.eyebrow}</span>
        <h1 className="font-display text-[40px] font-medium leading-[1.04] tracking-[-0.025em] md:text-[60px]">{LOOT_HEAD.title}</h1>
        <p className="max-w-[680px] text-[17px] leading-[1.7] text-fg-2">{LOOT_HEAD.lede}</p>
      </section>

      <section className={`${GUTTER} grid grid-cols-1 items-start gap-8 pb-20 lg:grid-cols-[260px_minmax(0,760px)_minmax(0,1fr)] lg:gap-14`}>
        <LootToc sections={LOOT_TOC} />

        <div className="flex flex-col gap-12 md:gap-14">
          <Card id="summary" accolade padding="lg" className="flex scroll-mt-24 flex-col gap-[18px]" role="region" aria-labelledby="summary-title">
            <h2 id="summary-title" className="font-display text-[28px] font-medium">{LOOT_SUMMARY.title}</h2>
            <ul className="flex list-disc flex-col gap-3 pl-5 text-base leading-[1.7] text-fg-2">
              {LOOT_SUMMARY.bullets.map((b, i) => (
                <li key={i}>
                  <span className="font-semibold text-fg">{b.lead}</span>
                  {'flag' in b && b.flag && <span className="text-fg-3"> {b.flag}</span>} {b.text}
                </li>
              ))}
            </ul>
          </Card>

          <section id="who" className="flex scroll-mt-24 flex-col gap-4">
            <h2 className={H2}>{LOOT_WHO.title}</h2>
            {LOOT_WHO.paragraphs.map((p, i) => (
              <p key={i} className={PROSE}>
                {p}
              </p>
            ))}
          </section>

          <section id="weigh" className="flex scroll-mt-24 flex-col gap-5">
            <h2 className={H2}>{LOOT_WEIGH.title}</h2>
            <p className={PROSE}>{LOOT_WEIGH.intro}</p>
            <ol className="flex flex-col divide-y divide-line-faint overflow-hidden rounded-card border border-line">
              {LOOT_WEIGH.factors.map((f, i) => (
                <li key={i} className={cn('grid grid-cols-[40px_minmax(0,1fr)] gap-4 px-5 py-5 md:grid-cols-[56px_minmax(0,1fr)] md:gap-5 md:px-6', i % 2 === 0 && 'bg-ink-850')}>
                  <span className="font-display text-[26px] leading-none text-sand" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold">{f.title}</span>
                    <span className="text-[15px] leading-[1.65] text-fg-2">{f.text}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section id="trials" className="flex scroll-mt-24 flex-col gap-4">
            <h2 className={H2}>{LOOT_TRIALS.title}</h2>
            {LOOT_TRIALS.paragraphs.map((p, i) => (
              <p key={i} className={PROSE}>
                {p}
              </p>
            ))}
          </section>

          <section id="faq" className="flex scroll-mt-24 flex-col gap-5">
            <h2 className={H2}>{LOOT_FAQ.title}</h2>
            <div className="flex flex-col gap-2.5">
              {LOOT_FAQ.items.map((item, i) => (
                <details key={i} open={i === 0} className="group rounded-card border border-line bg-ink-850 px-6 py-5">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden className="text-fg-3 transition-transform duration-[120ms] group-open:rotate-180">
                      <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                        <path d="M2 4l3 3 3-3" />
                      </svg>
                    </span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-[1.7] text-fg-2">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2.5">
            <span className="text-label font-semibold uppercase text-fg-3">{LOOT_ASIDE.updated.label}</span>
            <span className="text-[15px] font-semibold">{LOOT_ASIDE.updated.value}</span>
            <p className="text-[13px] leading-[1.6] text-fg-2">{LOOT_ASIDE.updated.text}</p>
          </Card>
          <Card className="flex flex-col gap-2.5">
            <span className="text-[15px] font-semibold">{LOOT_ASIDE.applying.title}</span>
            <p className="text-[13px] leading-[1.6] text-fg-2">{LOOT_ASIDE.applying.text}</p>
            <AccentLink href="/recruitment#apply" className="self-start">
              {LOOT_ASIDE.applying.linkLabel}
            </AccentLink>
          </Card>
        </div>
      </section>
    </>
  );
}
