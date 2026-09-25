import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { CONTROL, Field } from './Field';

export type SelectOption = { value: string; label: string };

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  options: SelectOption[];
  hint?: ReactNode;
  error?: ReactNode;
};

export function Select({ label, options, hint, error, id, className, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select {...rest} className={cn(CONTROL, 'h-[46px] px-3', className)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
