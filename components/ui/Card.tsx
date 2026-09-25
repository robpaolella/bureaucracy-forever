import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Accolade treatment: border goes sand-dim. That is the whole change. */
  accolade?: boolean;
  padding?: 'md' | 'lg';
  /** Raised on hover (ink-800) for cards that are links or rows. */
  hover?: boolean;
};

export function Card({ accolade = false, padding = 'md', hover = false, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-card border bg-ink-850',
        accolade ? 'border-sand-dim' : 'border-line',
        padding === 'lg' ? 'p-8' : 'p-6',
        hover && 'transition-colors duration-[120ms] hover:bg-ink-800',
        className,
      )}
    >
      {children}
    </div>
  );
}

type StatCardProps = Omit<CardProps, 'children'> & {
  eyebrow: string;
  figure: ReactNode;
  caption: ReactNode;
};

/**
 * Cinzel eyebrow in sand, a 40px Newsreader figure, a small caption. Home.html and
 * About.html draw the figure in Newsreader 500; accolade cards draw it in sand.
 */
export function StatCard({ eyebrow, figure, caption, accolade, className, ...rest }: StatCardProps) {
  return (
    <Card {...rest} accolade={accolade} className={cn('flex flex-col gap-1.5', className)}>
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.24em] text-sand">{eyebrow}</span>
      <span className={cn('tabular font-display text-[40px] font-medium leading-none', accolade && 'text-sand')}>
        {figure}
      </span>
      <span className="text-small text-fg-3">{caption}</span>
    </Card>
  );
}
