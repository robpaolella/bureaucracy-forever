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

/** A real switch: `<button role="switch">`, 44px hit box around a 44×24 track. */
export function Toggle({ label, checked, onChange, disabled, className }: ToggleProps) {
  const labelId = useId();
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <span id={labelId} className="text-sm text-fg-2">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
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
