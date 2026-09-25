import Image from 'next/image';
import type { Metadata } from 'next';
import { HeroContours } from '@/components/home/HeroContours';
import { AccentLink, SectionHead } from '@/components/site/SectionHead';
import { NightTimes } from '@/components/time/NightTimes';
import { ButtonLink, Card, StatusPill } from '@/components/ui';
import { CLOSING, HERO, PEDIGREE, PROGRESSION, PROGRESSION_NOTE, WEEK_NOTE, type ProgressionRow } from '@/content/home';
import { NEED_LABEL, teaserNeeds } from '@/content/recruitment';
import { RAID_NIGHTS } from '@/content/schedule';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import { WEEKDAY_NAMES } from '@/lib/time';

export const metadata: Metadata = {
  title: 'Bureaucracy — a 40-player raiding guild on WoW Forever',
  description: HERO.lede,
};

const SECTION = 'border-b border-line-faint px-4 md:px-gutter';

function Hero() {
  return (
    <section className={cn(SECTION, 'relative overflow-hidden pb-16 pt-16 md:pb-24 md:pt-28')}>
      <HeroContours />
      {/* Column mark bleeding off the right edge at 5.5%. Removed on mobile (docs/04). */}
      <Image
        src="/brand/mark.png"
        alt=""
        aria-hidden
        width={493}
        height={560}
        priority
        className="pointer-events-none absolute right-gutter top-[60px] hidden opacity-[0.055] lg:block"
      />
      <div className="relative flex max-w-[880px] flex-col gap-6 md:gap-8">
        <span className="font-eyebrow text-eyebrow font-semibold uppercase tracking-[0.32em] text-sand">{HERO.eyebrow}</span>
        <h1 className="font-display text-[40px] font-medium leading-[1.02] tracking-[-0.028em] text-pretty md:text-[84px]">
          {HERO.headline[0]}
          <br />
          {HERO.headline[1]}
        </h1>
        <p className="max-w-[620px] text-[17px] leading-[1.6] text-fg-2 md:text-[19px]">{HERO.lede}</p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <ButtonLink href={HERO.primary.href} size="lg" className="font-bold">
            {HERO.primary.label}
          </ButtonLink>
          <ButtonLink href={HERO.secondary.href} size="lg" variant="secondary">
            {HERO.secondary.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

function PedigreeStrip() {
  return (
    <section className="grid grid-cols-1 border-b border-line-faint md:grid-cols-3" aria-label="Guild record">
      {PEDIGREE.map((p, i) => (
        <div
          key={p.figure}
          className={cn(
            'flex flex-col gap-2.5 border-line-faint px-4 py-8 md:py-11',
            i < PEDIGREE.length - 1 && 'border-b md:border-b-0 md:border-r',
            i === 0 && 'md:pl-gutter md:pr-12',
            i === 1 && 'md:px-12',
            i === 2 && 'md:pl-12 md:pr-gutter',
          )}
        >
          <span className="font-display text-[32px] font-medium leading-none text-sand md:text-[40px]">{p.figure}</span>
          <span className="text-[15px] leading-[1.6] text-fg-2">{p.text}</span>
        </div>
      ))}
    </section>
  );
}

function ProgressionRowView({ row }: { row: ProgressionRow }) {
  const cleared = row.state === 'cleared';
  const current = row.state === 'current';
  const locked = row.state === 'locked';
  const pct = row.total ? Math.round((row.killed / row.total) * 100) : 0;
  return (
    <div className={cn('flex items-center gap-4 px-5 py-5 md:gap-6 md:px-[26px] md:py-[22px]', current && 'bg-ink-800')}>
      <div className="flex w-[130px] shrink-0 flex-col gap-[3px] md:w-[210px]">
        <span className={cn('text-base font-semibold', locked ? 'text-fg-3' : 'text-fg')}>{row.name}</span>
        <span className={cn('text-xs', current ? 'text-sand' : 'text-fg-3')}>
          {current ? `Current · ${row.size}` : row.size}
        </span>
      </div>
      <div
        className={cn('h-2 flex-1 overflow-hidden rounded-full', locked ? 'bg-ink-800' : 'bg-ink-700')}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={row.total || 1}
        aria-valuenow={row.killed}
        aria-label={`${row.name}: ${locked ? 'locked' : `${row.killed} of ${row.total} bosses`}`}
      >
        {!locked && <div className={cn('h-2', cleared ? 'bg-ok' : 'bg-sand')} style={{ width: `${pct}%` }} />}
      </div>
      <span
        className={cn(
          'tabular w-[64px] shrink-0 text-right font-semibold md:w-[92px]',
          cleared && 'text-[15px] text-ok',
          current && 'text-[15px] text-sand',
          locked && 'text-[13px] text-fg-3',
        )}
      >
        {locked ? 'Locked' : `${row.killed} / ${row.total}`}
      </span>
    </div>
  );
}

function Progression() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="Progression" title="Where we are this tier" link={{ href: '/about', label: 'Full history →' }} />
      <div className="flex flex-col divide-y divide-line-faint overflow-hidden rounded-card border border-line bg-ink-850">
        {PROGRESSION.map((row) => (
          <ProgressionRowView key={row.name} row={row} />
        ))}
      </div>
      <p className="text-xs text-fg-3">{PROGRESSION_NOTE}</p>
    </div>
  );
}

function TheWeek() {
  return (
    <div className="flex flex-col gap-6">
      <SectionHead eyebrow="The week" title="Three nights" />
      <div className="flex flex-col gap-3">
        {RAID_NIGHTS.map((night) => (
          <Card key={night.day} className="flex items-center justify-between px-[22px] py-5">
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold">{WEEKDAY_NAMES[night.day]}</span>
              <span className="text-[13px] text-fg-3">
                {night.kind}
                {night.optional && ' · optional'}
              </span>
            </div>
            <NightTimes night={night} />
          </Card>
        ))}
      </div>
      <div className="rounded-card border border-teal-line bg-teal-wash px-5 py-[18px] text-[13px] leading-[1.6] text-teal-text">{WEEK_NOTE}</div>
      <AccentLink href="/schedule" className="self-start">
        Full schedule →
      </AccentLink>
    </div>
  );
}

const PILL_TONE = { high: 'ok', medium: 'warn', closed: 'closed' } as const;

function RecruitmentTeaser() {
  const cards = teaserNeeds();
  return (
    <section className={cn(SECTION, 'flex flex-col gap-7 py-16 md:py-[88px]')}>
      <SectionHead eyebrow="Recruitment" title="What we're short of" link={{ href: '/recruitment', label: 'Every class and spec →' }} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.wowClass} className="flex flex-col gap-3.5">
            <span className="text-lg font-semibold" style={{ color: CLASS_COLORS[c.wowClass].onInk }}>
              {c.label}
            </span>
            <span className="text-[13px] text-fg-2">{c.specs.join(' · ')}</span>
            <StatusPill tone={PILL_TONE[c.status]} className="self-start">
              {NEED_LABEL[c.status]}
            </StatusPill>
          </Card>
        ))}
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="flex items-center justify-between gap-16 px-4 py-16 md:px-gutter md:py-24">
      <div className="flex max-w-[700px] flex-col gap-[18px]">
        <h2 className="font-display text-[34px] font-medium leading-[1.08] tracking-[-0.02em] md:text-[48px]">{CLOSING.headline}</h2>
        <p className="text-[17px] leading-[1.65] text-fg-2">{CLOSING.text}</p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <ButtonLink href={CLOSING.primary.href} size="lg" className="font-bold">
            {CLOSING.primary.label}
          </ButtonLink>
          <ButtonLink href={CLOSING.secondary.href} size="lg" variant="secondary">
            {CLOSING.secondary.label}
          </ButtonLink>
        </div>
      </div>
      <Image src="/brand/mark.png" alt="" aria-hidden width={176} height={200} className="hidden opacity-[0.14] lg:block" />
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <PedigreeStrip />
      <section className={cn(SECTION, 'grid grid-cols-1 gap-12 py-16 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10 lg:py-[88px]')}>
        <Progression />
        <TheWeek />
      </section>
      <RecruitmentTeaser />
      <ClosingCta />
    </>
  );
}
