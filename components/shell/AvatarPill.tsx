'use client';

import Link from 'next/link';
import { useId, useRef } from 'react';
import { cn } from '@/lib/cn';
import { LOGOUT_URL } from '@/lib/config';
import { CLASS_COLORS, type WowClass } from '@/lib/design/class-colors';
import { Chevron } from './NavGroup';
import { useDisclosure } from './useDismiss';

type AvatarPillProps = {
  name: string;
  wowClass: WowClass;
  officer: boolean;
};

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

/**
 * 28px circle with initials in the member's class color, name beside it, inside a
 * full-radius pill. Officers carry a compact Officer badge instead of the chevron.
 */
export function AvatarPill({ name, wowClass, officer }: AvatarPillProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, toggle } = useDisclosure(containerRef, triggerRef);
  const id = useId();
  const color = CLASS_COLORS[wowClass].onInk;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${name}, account menu`}
        onClick={toggle}
        className="flex h-11 items-center gap-2.5 rounded-full border border-line pl-1.5 pr-3 transition-colors duration-[120ms] hover:bg-ink-850"
      >
        <span
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold',
            officer ? 'border-sand-dim bg-sand-wash' : 'border-line-strong bg-ink-700',
          )}
          style={{ color }}
        >
          {initials(name)}
        </span>
        <span className="text-[13px] font-semibold" style={{ color }}>
          {name}
        </span>
        {officer ? (
          <span className="rounded-tag border border-sand-dim bg-sand-wash px-[7px] py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-sand">
            Officer
          </span>
        ) : (
          <Chevron className="text-fg-3" />
        )}
      </button>
      <div
        id={id}
        className={cn(
          'absolute right-0 top-full z-20 mt-2 w-[200px] flex-col gap-0.5 rounded-card border border-line-strong bg-ink-800 p-2 shadow-pop',
          open ? 'flex' : 'hidden',
        )}
      >
        <Link
          href={LOGOUT_URL}
          className="flex items-center rounded-control px-3 py-[11px] text-sm text-fg-2 transition-colors duration-[120ms] hover:bg-ink-700 hover:text-fg"
        >
          Log out
        </Link>
      </div>
    </div>
  );
}
