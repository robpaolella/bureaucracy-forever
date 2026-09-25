import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Drops opacity to 0.75, disables the button and prepends a spinner in the text color. */
  loading?: boolean;
};

/** Icon-only buttons are 44×44 and must carry an aria-label. */
export type ButtonProps =
  | (BaseProps & { iconOnly?: false })
  | (BaseProps & { iconOnly: true; 'aria-label': string });

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-sand text-ink-950 tracking-[0.02em]',
  secondary: 'border border-line-strong text-fg',
  ghost: 'text-fg-2',
  danger: 'border border-stop-line text-stop',
};

// `sm` is narrower, not shorter. 44px is the floor everywhere.
const SIZE: Record<ButtonSize, string> = {
  lg: 'h-[52px] px-7 text-[15px]',
  md: 'h-11 px-[22px] text-sm',
  sm: 'h-11 px-4 text-[13px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconOnly = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const inert = disabled || loading;
  return (
    <button
      type={type}
      disabled={inert}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2.5 rounded-control font-semibold transition-[filter] duration-[120ms]',
        // Disabled replaces the variant outright; stacking would let the variant fill win.
        disabled && !loading ? 'cursor-not-allowed bg-ink-700 text-fg-3' : VARIANT[variant],
        iconOnly ? 'h-11 w-11 px-0' : SIZE[size],
        // tokens.css: ink-700 is "input fill, small button fill".
        size === 'sm' && variant === 'secondary' && !disabled && 'bg-ink-700',
        !inert && 'hover:brightness-110',
        loading && 'opacity-75',
        className,
      )}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="block h-[13px] w-[13px] animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  );
}
