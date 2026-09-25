import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

// `text-label` bakes in 0.14em letter-spacing; the badges below override it with an
// explicit `tracking-[…]`. That works because Tailwind emits letter-spacing utilities
// after the font-size scale, not because of class order in the string.

type SpanProps = HTMLAttributes<HTMLSpanElement> & { children: ReactNode };

/** Neutral label chip: ink-700, line-strong, radius tag. Roles, specs, plain facts. */
export function Tag({ className, children, ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center rounded-tag border border-line-strong bg-ink-700 px-2.5 py-[5px] text-xs font-semibold text-fg-2',
        className,
      )}
    >
      {children}
    </span>
  );
}

export type StatusTone = 'ok' | 'warn' | 'stop' | 'closed';

const STATUS: Record<StatusTone, { pill: string; dot: string }> = {
  ok: { pill: 'border-ok-line bg-ok-wash text-ok', dot: 'bg-ok' },
  warn: { pill: 'border-warn-line bg-warn-wash text-warn', dot: 'bg-warn' },
  stop: { pill: 'border-stop-line bg-stop-wash text-stop', dot: 'bg-stop' },
  closed: { pill: 'border-line-strong bg-ink-700 text-fg-muted', dot: 'bg-fg-3' },
};

/** Status is never color alone: the pill always carries its word. */
export function StatusPill({ tone, className, children, ...rest }: SpanProps & { tone: StatusTone }) {
  const t = STATUS[tone];
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center gap-[7px] rounded-full border px-[11px] py-[5px] text-xs font-semibold',
        t.pill,
        className,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
      {children}
    </span>
  );
}

export type Rank = 'officer' | 'raider' | 'trial' | 'social';

const RANK: Record<Rank, { label: string; className: string }> = {
  officer: { label: 'Officer', className: 'border-sand-dim bg-sand-wash text-sand' },
  raider: { label: 'Raider', className: 'border-line-strong bg-ink-700 text-fg-2' },
  trial: { label: 'Trial', className: 'border-line bg-ink-700 text-fg-3' },
  social: { label: 'Social', className: 'border-line bg-ink-700 text-fg-3' },
};

/** Officer is the only rank that takes sand. */
export function RankBadge({ rank, className, ...rest }: Omit<SpanProps, 'children'> & { rank: Rank }) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center rounded-tag border px-2.5 py-[5px] text-label font-bold uppercase tracking-[0.1em]',
        RANK[rank].className,
        className,
      )}
    >
      {RANK[rank].label}
    </span>
  );
}

export type SignupSource = 'web' | 'discord';

/** Where a sign-up came from. Always present on a sign-up row, never inferred or hidden. */
export function SourceBadge({ source, className, ...rest }: Omit<SpanProps, 'children'> & { source: SignupSource }) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex items-center rounded-tag border px-[9px] py-1 text-label font-semibold uppercase tracking-[0.06em]',
        source === 'discord' ? 'border-teal-dim text-teal' : 'border-line-strong text-fg-muted',
        className,
      )}
    >
      {source === 'discord' ? 'via Discord' : 'via web'}
    </span>
  );
}

/** Sand disc with a count. Pending applications, unread notes. */
export function CountBadge({ className, children, ...rest }: SpanProps) {
  return (
    <span
      {...rest}
      className={cn(
        'tabular inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-sand px-[7px] text-label font-bold tracking-normal text-ink-950',
        className,
      )}
    >
      {children}
    </span>
  );
}
