import { ClassAvatar, SourceBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { RESPONSES, type SignupRow, type SignupSections } from '@/lib/raids';
import { relativeDate } from '@/lib/time';
import { SECTION_EMPTY, SECTIONS, SET_BY, UNKNOWN_MAIN } from '@/content/raid';

type Props = {
  sections: SignupSections;
  /** ISO instant the page rendered at; relative timestamps are measured from it. */
  now: string;
};

/**
 * Accepted / Tentative / Absent (docs/04 § Raid detail § Sign-up list). 44px rows with the
 * class-coloured initial avatar, the character in class colour, class · spec · role, then
 * the source badge (or who set it) and a relative timestamp. Absent rows fade to 60% and
 * show the reason if one was given.
 */
export function SignupList({ sections, now }: Props) {
  const at = new Date(now);
  return (
    <div className="flex flex-col gap-6">
      {RESPONSES.map((key) => (
        <section key={key} className="flex flex-col gap-2" aria-labelledby={`signups-${key}`}>
          <h2 id={`signups-${key}`} className="flex items-baseline gap-2 text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
            {SECTIONS[key]}
            <span className="tabular text-fg-2">{sections[key].length}</span>
          </h2>
          {sections[key].length === 0 ? (
            <p className="px-1 text-sm text-fg-3">{SECTION_EMPTY[key]}</p>
          ) : (
            <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-850">
              {sections[key].map((row) => (
                <Row key={row.userId} row={row} at={at} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function Row({ row, at }: { row: SignupRow; at: Date }) {
  const color = row.wowClass ? CLASS_COLORS[row.wowClass].onInk : undefined;
  const meta = row.wowClass ? [CLASS_COLORS[row.wowClass].label, row.spec, row.role ? ROLE_LABELS[row.role] : null].filter(Boolean).join(' · ') : UNKNOWN_MAIN;
  return (
    <li className={cn('flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2', row.response === 'absent' && 'opacity-60')}>
      <ClassAvatar name={row.name} wowClass={row.wowClass} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold" style={{ color }}>
          {row.name}
        </span>
        <span className="truncate text-small text-fg-3">{meta}</span>
        {row.response === 'absent' && row.reason && <span className="text-small italic text-fg-2">“{row.reason}”</span>}
      </div>
      {row.setBy ? (
        <span className="text-small text-fg-3">
          {SET_BY} <span className="font-semibold text-fg-2">{row.setBy}</span>
        </span>
      ) : (
        <SourceBadge source={row.source} />
      )}
      <time dateTime={row.updatedAt} className="w-20 text-right text-small text-fg-3">
        {relativeDate(new Date(row.updatedAt), at)}
      </time>
    </li>
  );
}
