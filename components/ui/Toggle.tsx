'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type ToggleProps = {
  label: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A real switch: `<button role="switch">` with a 44px hit box around a 44×24 track.
 * A <button> is a labelable element, so the text is a real <label> and clicking it
 * toggles too, matching the whole-row affordance of Choice.
 */
export function Toggle({ label, checked, onChange, disabled, className }: ToggleProps) {
  const id = useId();
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <label htmlFor={id} className="min-h-11 flex items-center text-sm text-fg-2">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="flex h-11 w-11 items-center rounded-control disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          className={cn(
            'flex h-6 w-11 items-center rounded-full p-[3px] transition-colors duration-[120ms]',
            checked ? 'justify-end bg-teal-dim' : 'justify-start border border-line-strong bg-ink-700',
          )}
        >
          <span className={cn('block h-[18px] w-[18px] rounded-full', checked ? 'bg-teal' : 'bg-fg-3')} />
        </span>
      </button>
    </div>
  );
}
