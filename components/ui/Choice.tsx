import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FIELD_LABEL } from './Field';

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type: 'radio' | 'checkbox';
  label: ReactNode;
  /**
   * Card treatment for pickers (Raider/Social, availability answers): 46px row on
   * ink-700 that goes teal-wash with a teal-dim border when selected.
   */
  card?: boolean;
};

export function Choice({ type, label, card = false, className, ...rest }: ChoiceProps) {
  return (
    <label
      className={cn(
        card
          ? 'flex h-[46px] items-center gap-3 rounded-control border border-line-strong bg-ink-700 px-3.5 text-[15px] text-fg has-[:checked]:border-teal-dim has-[:checked]:bg-teal-wash'
          : 'flex min-h-11 items-start gap-3 text-sm leading-normal text-fg-2',
        className,
      )}
    >
      <input type={type} {...rest} className={cn('h-4 w-4 shrink-0 accent-teal', !card && 'mt-0.5')} />
      <span>{label}</span>
    </label>
  );
}

/** A fieldset with the field-label treatment on its legend. */
export function ChoiceGroup({
  legend,
  children,
  className,
}: {
  legend: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-2.5', className)}>
      <legend className={cn(FIELD_LABEL, 'mb-2.5')}>{legend}</legend>
      {children}
    </fieldset>
  );
}
