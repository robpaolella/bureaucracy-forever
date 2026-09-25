'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { isActive } from '@/lib/nav';

type NavLinkProps = {
  href: string;
  children: ReactNode;
  /** Header link: 14px/500, active gets fg text and a 2px sand underline. */
  variant?: 'header' | 'drawer' | 'menu';
  className?: string;
  onNavigate?: () => void;
};

export function NavLink({ href, children, variant = 'header', className, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const active = isActive(pathname, href);
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
      className={cn(
        variant === 'header' &&
          cn(
            'flex h-[72px] items-center border-b-2 text-sm font-medium transition-colors duration-[120ms]',
            active ? 'border-sand text-fg' : 'border-transparent text-fg-2 hover:text-fg',
          ),
        variant === 'drawer' &&
          cn('block rounded-control px-3 py-3.5 text-base text-fg', active && 'bg-teal-wash font-semibold'),
        variant === 'menu' &&
          cn(
            'flex items-center justify-between rounded-control px-3 py-[11px] text-sm transition-colors duration-[120ms]',
            active ? 'bg-teal-wash font-semibold text-fg' : 'text-fg-2 hover:bg-ink-700 hover:text-fg',
          ),
        className,
      )}
    >
      {children}
    </Link>
  );
}
