import { cn } from '@/lib/cn';

type Props = {
  value: number;
  /** The requirement. The track reads ok when value ≥ max, warn when short, stop at zero. */
  max: number;
  /** The meter's accessible name, e.g. "Healers". Required: the bar has no text of its own. */
  label: string;
  className?: string;
};

/**
 * A 6px track (docs/04 § Raid detail summary card). Fill is `ok` when the requirement is
 * met, `warn` when short and `stop` at zero, and the numbers always sit beside it, so the
 * colour is never the only signal.
 */
export function ProgressTrack({ value, max, label, className }: Props) {
  const ratio = max <= 0 ? 1 : Math.min(1, value / max);
  const tone = value <= 0 ? 'bg-stop' : value >= max ? 'bg-ok' : 'bg-warn';
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={`${value} of ${max}`}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-700', className)}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-[120ms]', tone)} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
