import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/**
 * The link style from docs/02: teal text, 1px teal-dim underline, 2px beneath.
 * A separate thing from Button, never a variant of it.
 */
export function TextLink({ className, children, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={cn(
        'inline-block border-b border-teal-dim pb-0.5 text-sm font-semibold text-teal transition-[filter] duration-[120ms] hover:brightness-110',
        className,
      )}
    >
      {children}
    </Link>
  );
}
