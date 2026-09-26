'use client';

import { useId, useRef } from 'react';
import { useDisclosure } from '@/components/shell/useDismiss';
import { cn } from '@/lib/cn';
import { Choice } from './Choice';
import { CONTROL } from './Field';

export type MultiSelectOption<V extends string> = { value: V; label: string };

type Props<V extends string> = {
  label: string;
  options: readonly MultiSelectOption<V>[];
  values: readonly V[];
  onChange: (values: V[]) => void;
  /** "Any class" when nothing is picked. */
  placeholder?: string;
  /** Plural for the count summary: "3 classes". Defaults to the label plus "s". */
  plural?: string;
  className?: string;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={cn('shrink-0 transition-transform duration-[120ms]', open && 'rotate-180')} aria-hidden>
      <path d="M2.5 4.5L6 8l3.5-3.5" />
    </svg>
  );
}

/**
 * A 44px control that opens a checklist popover. The button reads the selection back
 * ("Any class", "Priest", "3 classes") so the filter is legible when closed. Escape and an
 * outside click close it; focus returns to the button when it closed from inside.
 */
export function MultiSelect<V extends string>({ label, options, values, onChange, placeholder, plural, className }: Props<V>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, toggle } = useDisclosure(containerRef, triggerRef);
  const listId = useId();

  const summary =
    values.length === 0
      ? placeholder ?? `Any ${label.toLowerCase()}`
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? ''
        : `${values.length} ${plural ?? `${label.toLowerCase()}s`}`;

  const set = (v: V, checked: boolean) => onChange(checked ? [...values, v] : values.filter((x) => x !== v));

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${label}: ${summary}`}
        onClick={toggle}
        className={cn(CONTROL, 'flex h-11 items-center justify-between gap-3 px-3.5 text-left', values.length > 0 && 'border-teal-dim')}
      >
        <span className="truncate">
          <span className="text-fg-3">{label} · </span>
          {summary}
        </span>
        <Chevron open={open} />
      </button>
      <div
        id={listId}
        className={cn('absolute left-0 top-full z-20 mt-2 min-w-full flex-col gap-0.5 rounded-card border border-line-strong bg-ink-800 p-2 shadow-pop', open ? 'flex' : 'hidden')}
      >
        {options.map((o) => (
          <Choice
            key={o.value}
            type="checkbox"
            label={o.label}
            checked={values.includes(o.value)}
            onChange={(e) => set(o.value, e.target.checked)}
            className="min-h-10 items-center whitespace-nowrap rounded-control px-2.5 hover:bg-ink-700"
          />
        ))}
      </div>
    </div>
  );
}
