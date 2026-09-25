import {
  cloneElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

/**
 * Field label. docs/02 names the `label` token (11px / 0.14em); Components.html draws
 * labels at 12px / 0.08em and the artboard wins for anything visual. One constant so
 * every control label agrees.
 */
export const FIELD_LABEL = 'text-xs font-semibold uppercase tracking-[0.08em] text-fg-2';

/**
 * Shared control surface: ink-700 fill, line-strong border, 15px text. Error state via
 * the arbitrary aria variant: Tailwind 3.4 ships no `aria-invalid:` shorthand.
 */
export const CONTROL =
  'w-full rounded-control border border-line-strong bg-ink-700 text-[15px] text-fg placeholder:text-fg-3 aria-[invalid=true]:border-stop-line';

/**
 * A field pre-filled from Discord and not editable. Applied only to Input: the CSS
 * `:read-only` pseudo-class also matches <select>, so it cannot live in CONTROL.
 */
const READ_ONLY = 'read-only:border-line read-only:bg-ink-800 read-only:text-fg-3';

type ControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

type FieldProps = {
  label: string;
  /** Help text under the control. The hint slot is the error slot; they never both show. */
  hint?: ReactNode;
  error?: ReactNode;
  id?: string;
  className?: string;
  children: ReactElement<ControlProps>;
};

export function Field({ label, hint, error, id: givenId, className, children }: FieldProps) {
  const autoId = useId();
  const id = givenId ?? autoId;
  const noteId = `${id}-note`;
  const note = error ?? hint;

  const control = cloneElement(children, {
    id,
    'aria-describedby': note ? noteId : undefined,
    'aria-invalid': error ? true : undefined,
  });

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {control}
      {note && (
        <span id={noteId} className={cn('text-xs', error ? 'text-stop' : 'text-fg-3')}>
          {note}
        </span>
      )}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL, READ_ONLY, 'h-[46px] px-3.5', className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL, 'resize-y px-3.5 py-3 leading-relaxed', className)} />;
}
