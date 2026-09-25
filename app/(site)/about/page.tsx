import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@/components/ui';
import { ABOUT_HEAD, ACCOLADES, HISTORY, HOW_WE_RUN, OFFICERS } from '@/content/about';
import { cn } from '@/lib/cn';
import { MEMBER_LINKS } from '@/lib/nav';
import { CLASS_COLORS } from '@/lib/design/class-colors';

export const metadata: Metadata = {
  title: 'About — Bureaucracy',
  description: ABOUT_HEAD.paragraphs[0],
};

const SECTION = 'border-b border-line-faint px-4 py-16 md:px-gutter md:py-20';
const EYEBROW = 'font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand';
const H2 = 'font-display text-[32px] font-medium leading-[1.1] md:text-[42px]';

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

function Head() {
  return (
    <section className="grid grid-cols-1 items-start gap-10 border-b border-line-faint px-4 pb-14 pt-16 md:px-gutter md:pt-[88px] lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
      <div className="flex flex-col gap-7">
        <span className="font-eyebrow text-eyebrow font-semibold uppercase tracking-[0.32em] text-sand">{ABOUT_HEAD.eyebrow}</span>
        <h1 className="font-display text-[40px] font-medium leading-[1.04] tracking-[-0.025em] md:text-display-xl">{ABOUT_HEAD.title}</h1>
        <div className="flex max-w-[660px] flex-col gap-5 text-[17px] leading-[1.75] text-fg-2">
          {ABOUT_HEAD.paragraphs.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </div>
      </div>
      <Card padding="lg" className="flex flex-col gap-4">
        <Image src="/brand/mark.png" alt="" aria-hidden width={56} height={64} className="opacity-50" />
        <h2 className="font-display text-[26px] font-medium leading-[1.2]">{HOW_WE_RUN.title}</h2>
        <ul className="flex list-disc flex-col gap-3 pl-5 text-[15px] leading-[1.6] text-fg-2">
          {HOW_WE_RUN.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

function Accolades() {
  return (
    <section className={cn(SECTION, 'flex flex-col gap-9')}>
      <div className="flex flex-col gap-2.5">
        <span className={EYEBROW}>{ACCOLADES.eyebrow}</span>
        <h2 className={H2}>{ACCOLADES.title}</h2>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {ACCOLADES.cards.map((c) => (
          <Card key={c.title} accolade padding="lg" className="flex flex-col gap-3">
            <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.24em] text-sand">{c.eyebrow}</span>
            <span className="font-display text-[28px] font-medium leading-[1.15] md:text-[34px]">{c.title}</span>
            <span className="text-[15px] leading-[1.65] text-fg-2">{c.text}</span>
          </Card>
        ))}
      </div>
    </section>
  );
}

function History() {
  return (
    <section className={cn(SECTION, 'grid grid-cols-1 gap-10 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16')}>
      <div className="flex flex-col gap-3.5">
        <span className={EYEBROW}>{HISTORY.eyebrow}</span>
        <h2 className={H2}>{HISTORY.title}</h2>
        <p className="text-[15px] leading-[1.7] text-fg-3">{HISTORY.note}</p>
      </div>
      <ol className="flex flex-col">
        {HISTORY.entries.map((e, i) => (
          <li
            key={e.title}
            className={cn(
              'grid grid-cols-1 gap-2 border-t border-line py-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8 md:py-[26px]',
              i === HISTORY.entries.length - 1 && 'border-b',
            )}
          >
            <span className={cn('text-[13px] font-semibold uppercase tracking-[0.1em]', e.highlight ? 'text-sand' : 'text-fg-3')}>{e.era}</span>
            <div className="flex flex-col gap-2">
              <span className={cn('text-[19px] font-semibold', e.highlight ? 'text-sand' : 'text-fg')}>{e.title}</span>
              <span className="text-[15px] leading-[1.65] text-fg-2">{e.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Officers() {
  return (
    <section className="flex flex-col gap-8 px-4 py-16 md:px-gutter md:py-20">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2.5">
          <span className={EYEBROW}>Officers</span>
          <h2 className={H2}>Who to ask</h2>
        </div>
        <Link href={MEMBER_LINKS.roster.href} className="flex min-h-11 items-center text-sm font-semibold text-teal transition-[filter] duration-[120ms] hover:brightness-110">
          Full roster →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {OFFICERS.map((o) => {
          const color = CLASS_COLORS[o.wowClass].onInk;
          return (
            <Card key={o.name} className="flex flex-col gap-3">
              <span
                className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-full border text-[15px] font-bold',
                  o.guildMaster ? 'border-sand-dim bg-sand-wash' : 'border-line-strong bg-ink-700',
                )}
                style={{ color }}
                aria-hidden
              >
                {initials(o.name)}
              </span>
              <div className="flex flex-col gap-[3px]">
                <span className="text-lg font-semibold" style={{ color }}>
                  {o.name}
                </span>
                <span className="text-[13px] text-fg-3">
                  {CLASS_COLORS[o.wowClass].label} · {o.title}
                </span>
              </div>
              <span className="text-[13px] leading-[1.6] text-fg-2">{o.blurb}</span>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <>
      <Head />
      <Accolades />
      <History />
      <Officers />
    </>
  );
}
