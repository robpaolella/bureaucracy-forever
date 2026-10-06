import { LocalTime } from '@/components/time/LocalTime';
import { ProgressTrack } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ROLE_LABELS, ROLES } from '@/lib/design/class-colors';
import { countTone, totalCounts, type RoleCounts } from '@/lib/raids';
import { SUMMARY } from '@/content/raid';

type Props = {
  counts: RoleCounts;
  requirements: RoleCounts;
  split: { web: number; discord: number };
  notes: string | null;
  cancelled: boolean;
  status: 'SCHEDULED' | 'LOCKED' | 'DONE' | 'CANCELLED';
  /** ISO instant sign-ups close (SYNC-SPEC §7). */
  locksAt: string;
};

const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn', stop: 'text-stop' } as const;

/**
 * The summary card (docs/04 § Raid detail): total accepted against the requirement as a
 * large tabular figure, a 6px track per role, the web / Discord split so officers see
 * which surface answers came from, when sign-ups lock, then the officer's notes as prose.
 */
export function RaidSummary({ counts, requirements, split, notes, cancelled, status, locksAt }: Props) {
  const total = totalCounts(counts);
  const required = totalCounts(requirements);
  return (
    <aside className="flex flex-col gap-5 rounded-card border border-line bg-ink-850 p-5" aria-labelledby="raid-summary">
      <div className="flex flex-col gap-1">
        <h2 id="raid-summary" className="font-eyebrow text-label font-semibold uppercase tracking-[0.24em] text-sand">
          {SUMMARY.heading}
        </h2>
        <p className="flex items-baseline gap-2">
          <span className={cn('tabular font-display text-[40px] font-medium leading-none', TONE_TEXT[countTone(total, required)])}>{total}</span>
          <span className="text-sm text-fg-3">
            {SUMMARY.acceptedOf} <span className="tabular font-semibold text-fg-2">{required}</span> {SUMMARY.needed}
          </span>
        </p>
        {cancelled && <p className="text-sm text-stop">{SUMMARY.cancelled}</p>}
        {!cancelled && status === 'LOCKED' && <p className="text-sm text-warn">{SUMMARY.locked}</p>}
        {!cancelled && status === 'DONE' && <p className="text-sm text-fg-3">{SUMMARY.done}</p>}
      </div>

      <ul className="flex flex-col gap-3">
        {ROLES.map((r) => (
          <li key={r} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-fg-2">{ROLE_LABELS[r]}</span>
              <span className="tabular">
                <span className={cn('font-semibold', TONE_TEXT[countTone(counts[r], requirements[r])])}>{counts[r]}</span>
                <span className="text-fg-3"> / {requirements[r]}</span>
              </span>
            </div>
            <ProgressTrack value={counts[r]} max={requirements[r]} label={ROLE_LABELS[r]} />
          </li>
        ))}
      </ul>

      <p className="tabular text-small text-fg-3">
        {split.web} via web · {split.discord} via Discord
      </p>

      {status === 'SCHEDULED' && !cancelled && (
        <div className="flex flex-col gap-1 border-t border-line-faint pt-4">
          <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{SUMMARY.locksAt}</h3>
          <LocalTime startsAt={locksAt} durationMin={0} />
        </div>
      )}

      <div className="flex flex-col gap-1.5 border-t border-line-faint pt-4">
        <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{SUMMARY.notes}</h3>
        {notes ? <p className="whitespace-pre-line text-[15px] leading-[1.65] text-fg-2">{notes}</p> : <p className="text-sm text-fg-3">{SUMMARY.noNotes}</p>}
      </div>
    </aside>
  );
}
