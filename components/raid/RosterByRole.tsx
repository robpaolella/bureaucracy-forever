import { ClassAvatar, SourceBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { groupByRole, type DetailRow } from '@/lib/raid-detail';
import { relativeDate } from '@/lib/time';
import { ANSWER_LABEL, ROSTER, SET_BY, UNKNOWN_MAIN } from '@/content/raid';
import { AnswerFor } from './AnswerFor';

type Props = {
  raidId: string;
  rows: DetailRow[];
  /** ISO instant the page rendered at; relative timestamps are measured from it. */
  now: string;
  /** Officers get "Answer for them" on every row while the raid is still ahead. */
  canAnswerFor: boolean;
  /** After the raid: show who was marked attended instead of the answer control. */
  showAttendance: boolean;
};

const ANSWER_TONE: Record<string, string> = { accept: 'text-ok', tentative: 'text-warn', absent: 'text-stop' };

/**
 * The roster grouped by role (SYNC-SPEC §9.5): tanks, healers, melee, ranged, then anyone
 * without a main. Each row carries the Answer and Via columns; unanswered members are on
 * the list too, since the roster is derived from rank rather than from who has replied.
 */
export function RosterByRole({ raidId, rows, now, canAnswerFor, showAttendance }: Props) {
  const at = new Date(now);
  const groups = groupByRole(rows);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="roster-heading">
      <h2 id="roster-heading" className="flex items-baseline gap-2 text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
        {ROSTER.heading}
        <span className="tabular text-fg-2">{rows.length}</span>
      </h2>
      {groups.length === 0 ? (
        <p className="px-1 text-sm text-fg-3">{ROSTER.empty}</p>
      ) : (
        groups.map((group) => (
          <div key={group.role} className="flex flex-col gap-2">
            <h3 className="flex items-baseline gap-2 px-1 text-small font-semibold text-fg-2">
              {group.role === 'none' ? ROSTER.noRole : ROLE_LABELS[group.role]}
              <span className="tabular text-fg-3">{group.rows.length}</span>
            </h3>
            <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-850">
              <li className="hidden items-center gap-x-3 px-4 py-1.5 text-label font-semibold uppercase tracking-[0.08em] text-fg-3 md:flex" aria-hidden>
                <span className="w-6" />
                <span className="flex-1">{ROSTER.member}</span>
                <span className="w-[132px]">{ROSTER.answer}</span>
                <span className="w-28">{ROSTER.via}</span>
                <span className="w-20 text-right">{ROSTER.updated}</span>
              </li>
              {group.rows.map((row) => (
                <Row key={row.userId} raidId={raidId} row={row} at={at} canAnswerFor={canAnswerFor} showAttendance={showAttendance} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function Row({ raidId, row, at, canAnswerFor, showAttendance }: { raidId: string; row: DetailRow; at: Date; canAnswerFor: boolean; showAttendance: boolean }) {
  const color = row.wowClass ? CLASS_COLORS[row.wowClass].onInk : undefined;
  const meta = row.wowClass ? [CLASS_COLORS[row.wowClass].label, row.spec].filter(Boolean).join(' · ') : UNKNOWN_MAIN;
  return (
    <li className={cn('flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2', row.response === 'absent' && 'opacity-60')}>
      <ClassAvatar name={row.name} wowClass={row.wowClass} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold" style={{ color }}>
          {row.name}
        </span>
        <span className="truncate text-small text-fg-3">{meta}</span>
        {row.response === 'absent' && row.reason && (
          <span className="text-small italic text-fg-2">
            {ROSTER.reasonPrefix} “{row.reason}”
          </span>
        )}
      </div>
      <div className="w-[132px]">
        {canAnswerFor ? (
          <AnswerFor raidId={raidId} userId={row.userId} name={row.name} current={row.response} />
        ) : (
          <span className={cn('text-sm font-semibold', row.response ? ANSWER_TONE[row.response] : 'text-fg-3')}>{row.response ? ANSWER_LABEL[row.response] : ROSTER.noAnswer}</span>
        )}
        {showAttendance && row.attended !== null && <span className={cn('block text-small', row.attended ? 'text-ok' : 'text-fg-3')}>{row.attended ? ROSTER.attended : ROSTER.missed}</span>}
      </div>
      <div className="w-28">
        {row.response === null ? null : row.setBy ? (
          <span className="text-small text-fg-3">
            {SET_BY} <span className="font-semibold text-fg-2">{row.setBy}</span>
          </span>
        ) : (
          <SourceBadge source={row.source} />
        )}
      </div>
      <time dateTime={row.updatedAt} className="w-20 text-right text-small text-fg-3">
        {row.response === null ? '' : relativeDate(new Date(row.updatedAt), at)}
      </time>
    </li>
  );
}
