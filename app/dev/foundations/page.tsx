import Image from 'next/image';
import { CLASSES, CLASS_COLORS } from '@/lib/design/class-colors';

/**
 * Scratch page for build-order step 1. Mirrors design-handover/reference/Main.html
 * so the tokens can be checked side by side. Dev-only; not linked from anywhere.
 */

type Swatch = { name: string; hex: string; use: string; bg: string; border?: string; nameClass?: string; h?: string };

const GROUND: Swatch[] = [
  { name: 'ink-950', hex: '#06080B', use: 'page', bg: 'bg-ink-950', border: 'border border-line' },
  { name: 'ink-900', hex: '#0A0D12', use: 'bar', bg: 'bg-ink-900', border: 'border border-line' },
  { name: 'ink-850', hex: '#0E1219', use: 'card', bg: 'bg-ink-850', border: 'border border-line' },
  { name: 'ink-800', hex: '#141922', use: 'hover', bg: 'bg-ink-800', border: 'border border-line' },
  { name: 'ink-700', hex: '#1B222E', use: 'input', bg: 'bg-ink-700', border: 'border border-line' },
  { name: 'line', hex: '#232B38', use: 'hairline', bg: 'bg-line' },
  { name: 'line-strong', hex: '#323C4C', use: 'divider', bg: 'bg-line-strong' },
];

const TEXT_AND_ACCENT: Swatch[] = [
  { name: 'fg', hex: '#E8EDF7', use: 'body', bg: 'bg-fg' },
  { name: 'fg-2', hex: '#A3AFC2', use: 'secondary', bg: 'bg-fg-2' },
  { name: 'fg-3', hex: '#6F7C90', use: 'caption', bg: 'bg-fg-3' },
  { name: 'sand', hex: '#E4C08A', use: 'accolade', bg: 'bg-sand', nameClass: 'text-sand' },
  { name: 'teal', hex: '#6FC8DC', use: 'link, focus', bg: 'bg-teal', nameClass: 'text-teal' },
  { name: 'teal-wash', hex: '#0E2830', use: 'selected', bg: 'bg-teal-wash', border: 'border border-teal-dim' },
  { name: 'sand-wash', hex: '#241E14', use: 'accolade bg', bg: 'bg-sand-wash', border: 'border border-sand-dim' },
];

const STATUS: Swatch[] = [
  { name: 'ok', hex: '#79D0A0', use: 'open, accepted', bg: 'bg-ok', nameClass: 'text-ok', h: 'h-14' },
  { name: 'warn', hex: '#E9B872', use: 'medium, tentative', bg: 'bg-warn', nameClass: 'text-warn', h: 'h-14' },
  { name: 'stop', hex: '#E08A8A', use: 'closed, declined', bg: 'bg-stop', nameClass: 'text-stop', h: 'h-14' },
];

const TYPE_ROWS: { label: string; className: string; sample: string }[] = [
  { label: 'Eyebrow · Cinzel 600 · 12/0.3em', className: 'font-eyebrow text-eyebrow font-semibold uppercase text-sand', sample: 'Server First' },
  { label: 'Display XL · Newsreader 500 · 64/1.04', className: 'font-display text-display-xl font-medium', sample: 'Prepared, on time, first down' },
  { label: 'Display L · Newsreader 500 · 44/1.1', className: 'font-display text-display-l font-medium', sample: 'Forty people, one pull' },
  { label: 'Display M · Newsreader 500 · 30/1.2', className: 'font-display text-display-m font-medium', sample: 'What we expect of a raider' },
  { label: 'Title · Archivo 600 · 20/1.3', className: 'text-title font-semibold', sample: 'Tuesday, 8:00 PM server' },
  { label: 'Body · Archivo 400 · 16/1.65', className: 'max-w-[640px] text-body text-fg-2', sample: "We raid three nights a week and we finish on time. Consumables are your own, the strategy is the officers' and the loot is the guild's." },
  { label: 'Small · Archivo 400 · 13/1.55', className: 'text-small text-fg-2', sample: 'Last saved 2 minutes ago · detected timezone America/Los_Angeles' },
  { label: 'Label · Archivo 600 · 11/0.14em', className: 'text-label font-semibold uppercase text-fg-3', sample: 'Ranged DPS' },
];

const SPACING = [4, 8, 12, 16, 24, 32, 48, 64];
const RADII = ['rounded-tag', 'rounded-control', 'rounded-card', 'rounded-modal', 'rounded-full'];

const LABEL = 'text-xs font-semibold uppercase tracking-[0.14em] text-fg-3';
const CARD = 'rounded-card border border-line bg-ink-850';

function SectionHead({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <h2 className="font-display text-display-m font-medium">{title}</h2>
      <span className="text-small text-fg-3">{note}</span>
    </div>
  );
}

function SwatchRow({ swatches }: { swatches: Swatch[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-7">
      {swatches.map((s) => (
        <div key={s.name} className="flex flex-col gap-2.5">
          <div className={`${s.h ?? 'h-[76px]'} rounded-control ${s.bg} ${s.border ?? ''}`} />
          <div className={`text-xs font-semibold ${s.nameClass ?? ''}`}>{s.name}</div>
          <div className="tabular text-xs text-fg-3">
            {s.hex} · {s.use}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FoundationsPage() {
  return (
    <main className="flex flex-col gap-section px-4 pb-24 pt-20 md:px-gutter">
      <header className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-[18px]">
          <p className="font-eyebrow text-eyebrow font-semibold uppercase text-sand">Foundations</p>
          <h1 className="font-display text-[3.5rem] font-medium leading-[1.04] tracking-[-0.02em]">
            The Bureaucracy system
          </h1>
          <p className="max-w-[620px] text-body text-fg-2">
            One dark-first palette, three typefaces and a small set of primitives. Every page in this
            canvas is drawn from these tokens — nothing is styled twice.
          </p>
        </div>
        <Image src="/brand/wordmark.png" alt="Bureaucracy" width={149} height={30} className="opacity-90" priority />
      </header>

      <section className="flex flex-col gap-6">
        <SectionHead title="Mark" note="Three lockups. The column never sits on a fill lighter than #141922." />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className={`${CARD} flex flex-col gap-4 p-8`}>
            <div className="flex h-[120px] items-center justify-center">
              <Image src="/brand/wordmark.png" alt="Bureaucracy horizontal lockup" width={260} height={52} />
            </div>
            <div className={LABEL}>Horizontal · header, footer</div>
          </div>
          <div className={`${CARD} flex flex-col gap-4 p-8`}>
            <div className="flex h-[120px] items-center justify-center">
              <Image src="/brand/mark.png" alt="Bureaucracy column mark" width={81} height={92} />
            </div>
            <div className={LABEL}>Mark only · mobile, avatars</div>
          </div>
          <div className={`${CARD} flex flex-col gap-4 p-8`}>
            <div className="flex h-[120px] items-center justify-center">
              <Image src="/brand/tile.png" alt="Bureaucracy app tile" width={92} height={92} className="rounded-[18px]" />
            </div>
            <div className={LABEL}>Tile · favicon, Discord, OG card</div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-7">
        <SectionHead
          title="Color"
          note="Ink ground, ice text, two accents. Sand carries achievement; teal carries interaction."
        />
        <SwatchRow swatches={GROUND} />
        <SwatchRow swatches={TEXT_AND_ACCENT} />
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-7">
          {STATUS.map((s) => (
            <div key={s.name} className="flex flex-col gap-2.5">
              <div className={`h-14 rounded-control ${s.bg}`} />
              <div className={`text-xs font-semibold ${s.nameClass}`}>{s.name}</div>
              <div className="tabular text-xs text-fg-3">
                {s.hex} · {s.use}
              </div>
            </div>
          ))}
          <div className={`${CARD} col-span-3 flex items-center px-5 py-4 text-small leading-relaxed text-fg-2 lg:col-span-4`}>
            Status colors never appear alone — every status pill carries a word as well as a fill, so the
            table still reads in greyscale and for colour-blind raiders.
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <SectionHead
          title="Class colors"
          note="The one game convention we borrow. Used only on character names and role counts — never as a background fill."
        />
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-9">
          {CLASSES.map((cls) => {
            const c = CLASS_COLORS[cls];
            const lifted = c.onInk !== c.canonical;
            return (
              <div key={cls} className="flex flex-col gap-2 rounded-md border border-line bg-ink-850 px-3.5 py-4">
                <span className="text-[17px] font-semibold" style={{ color: c.onInk }}>
                  {c.label}
                </span>
                <span className="tabular text-label text-fg-3">
                  {c.onInk}
                  {lifted && cls !== 'priest' ? ' *' : ''}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-small leading-relaxed text-fg-3">
          * Shaman and Warlock are lifted from the in-game values (#0070DE, #9482C9), which fall under
          4.5:1 on ink. Store both: <span className="text-fg-2">canonical</span> for exports and addon
          parity, <span className="text-fg-2">onInk</span> for the web.
        </p>
      </section>

      <section className="flex flex-col gap-7">
        <SectionHead
          title="Typography"
          note="Cinzel for the one-word eyebrow. Newsreader for anything that makes a claim. Archivo for everything you operate."
        />
        <div className="grid grid-cols-1 items-baseline gap-x-12 lg:grid-cols-[220px_minmax(0,1fr)]">
          {TYPE_ROWS.map((row, i) => {
            const last = i === TYPE_ROWS.length - 1;
            const cell = `border-line py-[18px] ${last ? 'lg:border-b' : ''}`;
            return [
              <div key={`${row.label}-l`} className={`${cell} border-t pb-2 lg:pb-[18px] ${LABEL}`}>
                {row.label}
              </div>,
              <div key={`${row.label}-s`} className={`${cell} pt-0 lg:border-t lg:pt-[18px] ${last ? 'border-b' : ''} ${row.className}`}>
                {row.sample}
              </div>,
            ];
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`${CARD} flex flex-col gap-5 p-7`}>
          <h3 className="text-body font-semibold">Spacing — 4px base</h3>
          <div className="flex items-end gap-2.5">
            {SPACING.map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <div className="bg-teal" style={{ width: n, height: n }} />
                <span className="text-label text-fg-3">{n}</span>
              </div>
            ))}
          </div>
          <p className="text-small leading-relaxed text-fg-2">
            Page gutter 96 · section gap 72 · card padding 28 · control gap 12. Nothing lands off the
            4px step.
          </p>
        </div>

        <div className={`${CARD} flex flex-col gap-5 p-7`}>
          <h3 className="text-body font-semibold">Radius — restrained</h3>
          <div className="flex items-center gap-3.5">
            {RADII.map((r) => (
              <div key={r} className={`h-16 w-16 border border-line-strong bg-ink-700 ${r}`} />
            ))}
          </div>
          <p className="text-small leading-relaxed text-fg-2">
            2 tag · 4 button and input · 8 card · 14 modal · full avatar. The column mark is square-cut;
            the UI stays close to it.
          </p>
        </div>

        <div className={`${CARD} flex flex-col gap-5 p-7`}>
          <h3 className="text-body font-semibold">Depth — borders, not shadows</h3>
          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-line bg-ink-850 px-4 py-3.5 text-small text-fg-2">
              Level 1 — card on page
            </div>
            <div className="rounded-md border border-line-strong bg-ink-800 px-4 py-3.5 text-small text-fg-2">
              Level 2 — hover, popover
            </div>
            <div className="rounded-md border border-line-strong bg-ink-800 px-4 py-3.5 text-small text-fg-2 shadow-pop">
              Level 3 — modal only
            </div>
          </div>
          <p className="text-small leading-relaxed text-fg-2">
            On ink, a 1px hairline separates better than a shadow. Shadow is reserved for things that
            float over a scrim.
          </p>
        </div>
      </section>
    </main>
  );
}
