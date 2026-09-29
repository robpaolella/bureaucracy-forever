import { cn } from '@/lib/cn';

/** A five-point star in currentColor: outlined, or filled when `filled`. */
export function StarIcon({ filled = false, size = 18, className }: { filled?: boolean; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <path d="M10 2.2l2.35 4.9 5.35.7-3.92 3.73.98 5.32L10 14.27l-4.76 2.58.98-5.32L2.3 7.8l5.35-.7L10 2.2z" />
    </svg>
  );
}
