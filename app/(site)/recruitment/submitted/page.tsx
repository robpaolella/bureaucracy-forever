import Image from 'next/image';
import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui';
import { SUBMITTED } from '@/content/recruitment';
import { DISCORD_INVITE_URL } from '@/lib/config';
import { CLASS_COLORS, CLASSES, type WowClass } from '@/lib/design/class-colors';

export const metadata: Metadata = {
  title: 'Application received',
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/**
 * docs/04 § Application submitted: a short centred page, not a modal, because applicants
 * may land here from a fresh tab. The summary repeats what the form sent in the query
 * string, so nothing private is read back from the database.
 */
export default async function SubmittedPage({ searchParams }: { searchParams: SearchParams }) {
  const p = await searchParams;
  // Two names of up to twelve letters and the space between them.
  const character = one(p.character).slice(0, 25);
  const cls = one(p.class);
  const wowClass = (CLASSES as readonly string[]).includes(cls) ? (cls as WowClass) : null;
  const spec = one(p.spec).slice(0, 40);
  const path = one(p.path) === 'social' ? 'social' : 'raider';

  const rows: [string, string][] = [
    [SUBMITTED.summary.character, character || '—'],
    ...(wowClass ? ([[SUBMITTED.summary.wowClass, CLASS_COLORS[wowClass].label]] as [string, string][]) : []),
    ...(spec ? ([[SUBMITTED.summary.spec, spec]] as [string, string][]) : []),
    [SUBMITTED.summary.path, SUBMITTED.paths[path]],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-6 px-4 pb-24 pt-20 text-center md:pt-[120px]">
      <Image src="/brand/mark.png" alt="" width={42} height={48} className="w-10 opacity-40 md:w-12" />
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-ok">{SUBMITTED.eyebrow}</span>
      <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{SUBMITTED.title}</h1>
      <p className="text-[15px] leading-[1.7] text-fg-2">{SUBMITTED.body}</p>

      <dl className="grid w-full grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-card border border-line bg-ink-850 px-5 py-4 text-left text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-3">{label}</dt>
            <dd className="font-semibold" style={label === SUBMITTED.summary.character && wowClass ? { color: CLASS_COLORS[wowClass].onInk } : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={DISCORD_INVITE_URL}>{SUBMITTED.join}</ButtonLink>
        <ButtonLink href="/" variant="secondary">
          {SUBMITTED.back}
        </ButtonLink>
      </div>
      <p className="text-small text-fg-3">{SUBMITTED.mistake}</p>
    </div>
  );
}
