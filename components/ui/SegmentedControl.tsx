'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

export type SegmentTone = 'teal' | 'ok' | 'warn' | 'stop';

export type Segment<V extends string> = {
  value: V;
  label: string;
  /** Fill when selected. Default teal; the raid response control uses ok / warn / stop. */
  tone?: SegmentTone;
};

type Props<V extends string> = {
  options: readonly Segment<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** Screen-reader name for the group, or pass `labelledBy` instead. */
  label?: string;
  labelledBy?: string;
  size?: 'md' | 'sm';
  /** Stretch segments to fill the row. */
  fill?: boolean;
  disabled?: boolean;
  className?: string;
};

const SELECTED: Record<SegmentTone, string> = {
  teal: 'border-teal bg-teal-wash text-fg',
  ok: 'border-ok-line bg-ok-wash text-ok',
  warn: 'border-warn-line bg-warn-wash text-warn',
  stop: 'border-stop-line bg-stop-wash text-stop',
};

/**
 * A row of exclusive choices (Flat / By role / By class, Upcoming / Past, Accept /
 * Tentative / Absent). Real radio semantics: one tab stop, arrow keys move the
 * selection, Home and End jump, and the selected segment is the one in the tab order.
 * 44px tall by default; `sm` is 36px for filter bars.
 */
export function SegmentedControl<V extends string>({ options, value, onChange, label, labelledBy, size = 'md', fill = false, disabled = false, className }: Props<V>) {
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number | 'first' | 'last'> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, Home: 'first', End: 'last' };
    const step = keys[e.key];
    if (step === undefined || disabled) return;
    e.preventDefault();
    const current = Math.max(0, options.findIndex((o) => o.value === value));
    const next = step === 'first' ? 0 : step === 'last' ? options.length - 1 : (current + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      id={groupId}
      onKeyDown={move}
      className={cn('flex gap-1.5', fill ? 'w-full' : 'w-fit', className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (value === null && i === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-control border px-4 text-sm font-semibold transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50',
              size === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-11',
              fill && 'flex-1',
              selected ? SELECTED[o.tone ?? 'teal'] : 'border-line-strong bg-ink-800 text-fg-2 hover:bg-ink-700 hover:text-fg',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
