import { Chevron } from '@/components/shell/NavGroup';
import { cn } from '@/lib/cn';

type Props = {
  count: number;
  memberName: string;
  expanded: boolean;
  controlsId: string;
  onToggle: () => void;
  label: (count: number) => string;
};

/** Accessible disclosure used by both roster views and reusable by the officer roster. */
export function AltsToggle({ count, memberName, expanded, controlsId, onToggle, label }: Props) {
  return (
    <h3 className="m-0">
      <button
        type="button"
        aria-label={`${expanded ? 'Hide' : 'Show'} ${count} alts for ${memberName}`}
        aria-expanded={expanded}
        aria-controls={controlsId}
        onClick={onToggle}
        className="inline-flex h-11 items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
      >
        <span className="inline-flex items-center gap-1 rounded-tag border border-line-strong bg-ink-700 px-2.5 py-[5px] text-xs font-semibold text-fg-2">
          {label(count)}
          <Chevron className={cn('text-fg-3 transition-transform duration-[120ms] motion-reduce:transition-none', expanded && 'rotate-180')} />
        </span>
      </button>
    </h3>
  );
}
