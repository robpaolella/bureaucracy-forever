import { Skeleton, SkeletonText } from '@/components/ui';
import { INTERVIEW } from '@/content/interview';

const ROWS = Array.from({ length: 6 }, (_, i) => (i % 2 ? ['62%', '38%'] : ['45%', '80%']));

/**
 * PageSkeleton's bars inside the picker-sized squeeze card, so loading never brings back the
 * site nav and footer. Below 600px the card goes edge to edge, as the picker does.
 */
export function InterviewSkeleton() {
  return (
    <div className="flex flex-1 flex-col min-[600px]:items-center min-[600px]:justify-center min-[600px]:px-4 min-[600px]:pb-14 min-[600px]:pt-6 min-[960px]:px-6 min-[960px]:pb-[72px] min-[960px]:pt-8">
      <p role="status" className="sr-only">
        {INTERVIEW.loading}
      </p>
      <div className="w-full min-[600px]:max-w-[560px] min-[600px]:rounded-card min-[600px]:border min-[600px]:border-line min-[600px]:bg-ink-850 min-[960px]:max-w-[1040px]" aria-hidden>
        <div className="flex flex-col min-[960px]:grid min-[960px]:h-[600px] min-[960px]:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-2.5 px-4 pb-2 pt-4 min-[600px]:px-5 min-[600px]:pb-3 min-[600px]:pt-5 min-[960px]:gap-3 min-[960px]:p-7">
            <Skeleton width={96} height={10} />
            <Skeleton width={220} height={30} />
            <SkeletonText widths={['90%', '75%', '60%']} />
            <SkeletonText widths={['50%', '65%', '70%', '55%']} className="mt-2" />
          </div>
          <div className="flex flex-col gap-4 p-6 min-[960px]:border-l min-[960px]:border-line">
            <Skeleton width={140} height={14} />
            {ROWS.map((widths, i) => (
              <SkeletonText key={i} widths={widths} />
            ))}
          </div>
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-ink-900 px-4 py-3 min-[600px]:rounded-b-card min-[600px]:px-5 min-[960px]:static">
          <Skeleton width={180} height={12} />
          <Skeleton width={140} height={44} />
        </div>
      </div>
    </div>
  );
}
