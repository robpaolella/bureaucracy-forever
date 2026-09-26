import { Skeleton, SkeletonText } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * What a member or officer page looks like while its data loads (docs/07 § 11 "loading
 * skeletons"): the head's eyebrow, title and lede, then bars where the content goes. One
 * live region announces it; the bars themselves are decorative.
 */
export function PageSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11', className)}>
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div className="flex flex-col gap-3" aria-hidden>
        <Skeleton width={96} height={10} />
        <Skeleton width={260} height={36} />
        <Skeleton width="min(640px, 100%)" height={14} />
      </div>
      <div className="flex flex-col gap-3 rounded-card border border-line bg-ink-900 p-5" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonText key={i} widths={i % 2 ? ['62%', '38%'] : ['45%', '80%']} />
        ))}
      </div>
    </div>
  );
}
