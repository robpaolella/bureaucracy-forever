import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

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

type StyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

/** The button look, as a class string, so links can wear it too. */
export function buttonClassName({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  disabled = false,
  loading = false,
}: StyleOptions): string {
  const inert = disabled || loading;
  return cn(
    'inline-flex items-center justify-center gap-2.5 rounded-control font-semibold transition-[filter] duration-[120ms]',
    // Disabled replaces the variant outright; stacking would let the variant fill win.
    disabled && !loading ? 'cursor-not-allowed bg-ink-700 text-fg-3' : VARIANT[variant],
    iconOnly ? 'h-11 w-11 px-0' : SIZE[size],
    // tokens.css: ink-700 is "input fill, small button fill".
    size === 'sm' && variant === 'secondary' && !disabled && 'bg-ink-700',
    !inert && 'hover:brightness-110',
    loading && 'opacity-75',
  );
}

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
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClassName({ variant, size, iconOnly, disabled, loading }), className)}
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

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** A real <a> that looks like a button. For navigation, never for actions. */
export function ButtonLink({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={cn(buttonClassName({ variant, size }), className)}>
      {children}
    </Link>
  );
}
