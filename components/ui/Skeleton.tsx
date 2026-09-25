import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

type SkeletonProps = {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
};

/** One pulsing bar. The animation is `.skeleton` in globals.css (0.35→0.7 over 1.6s). */
export function Skeleton({ width = '100%', height = 12, className }: SkeletonProps) {
  return <div aria-hidden className={cn('skeleton rounded-tag bg-ink-700', className)} style={{ width, height }} />;
}

/** Three bars at the varied widths from docs/02. Use for roster, calendar, heatmap. */
export function SkeletonText({ widths = ['45%', '80%', '62%'], className }: { widths?: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy>
      {widths.map((w, i) => (
        <Skeleton key={i} width={w} />
      ))}
    </div>
  );
}
