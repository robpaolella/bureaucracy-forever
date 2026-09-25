import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** The teal "Something →" link used beside section heads. 44px hit box on 14px text. */
export function AccentLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        'flex min-h-11 items-center text-sm font-semibold text-teal transition-[filter] duration-[120ms] hover:brightness-110',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export const EYEBROW = 'font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand';

type SectionHeadProps = {
  eyebrow: string;
  title: string;
  /** Optional right-aligned accent link. */
  link?: { href: string; label: string };
  /** Optional line under the title, fg-3. */
  note?: ReactNode;
  /** Heading size: home sections use 38px, About/Schedule use 42px. */
  size?: 'md' | 'lg';
  className?: string;
};

/** Cinzel eyebrow over a Newsreader h2, with an optional accent link at the right. */
export function SectionHead({ eyebrow, title, link, note, size = 'md', className }: SectionHeadProps) {
  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div className="flex flex-col gap-2.5">
        <span className={EYEBROW}>{eyebrow}</span>
        <h2 className={cn('font-display font-medium leading-[1.1]', size === 'lg' ? 'text-[32px] md:text-[42px]' : 'text-[30px] md:text-[38px]')}>
          {title}
        </h2>
        {note && <p className="text-[15px] leading-[1.7] text-fg-3">{note}</p>}
      </div>
      {link && <AccentLink href={link.href}>{link.label}</AccentLink>}
    </div>
  );
}
