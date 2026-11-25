import { ClassAvatar, SourceBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, COMPOSITION_LABELS } from '@/lib/design/class-colors';
import { groupByRole, splitStanding, type DetailRow } from '@/lib/raid-detail';
import { relativeDate } from '@/lib/time';
import { ANSWER_LABEL, ROSTER, SET_BY, UNKNOWN_MAIN } from '@/content/raid';
import { AnswerFor } from './AnswerFor';
import { RosterLists } from './RosterLists';

type Props = {
  raidId: string;
  rows: DetailRow[];
  /** ISO instant the page rendered at; relative timestamps are measured from it. */
  now: string;
  /** Officers get "Answer for them" on every row while the raid is still ahead. */
  canAnswerFor: boolean;
  /** After the raid: show who was marked attended instead of the answer control. */
  showAttendance: boolean;
  /** Officers get "Nudge in Discord" on the No response list while the raid is open and posted. */
  officer: boolean;
  posted: boolean;
  open: boolean;
};

const ANSWER_TONE: Record<string, string> = { accept: 'text-ok', tentative: 'text-warn', absent: 'text-stop' };

/**
 * The roster (SYNC-SPEC §9.5): Tanks, Healers and DPS list only the members who accepted or are
 * tentative, grouped by the role of the character they bring, with an "No main set" group for an
 * answered member without one. Everyone else is in the No response and Absent lists below.
 */
export function RosterByRole({ raidId, rows, now, canAnswerFor, showAttendance, officer, posted, open }: Props) {
  const at = new Date(now);
  const groups = groupByRole(rows);
  const { noResponse, absent } = splitStanding(rows);
  const signed = groups.reduce((n, g) => n + g.rows.length, 0);
  return (
    <section className="flex flex-col gap-4" aria-labelledby="roster-heading">
      <h2 id="roster-heading" className="flex items-baseline gap-2 text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
        {ROSTER.heading}
        <span className="tabular text-fg-2 normal-case tracking-normal">{ROSTER.signedUp(signed, rows.length)}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="px-1 text-sm text-fg-3">{ROSTER.empty}</p>
      ) : (
        <>
          {groups.map((group) => (
            <div key={group.role} className="flex flex-col gap-2">
              <h3 className="flex items-baseline gap-2 px-1 text-small font-semibold text-fg-2">
                {group.role === 'none' ? ROSTER.noRole : COMPOSITION_LABELS[group.role]}
                <span className="tabular text-fg-3">{group.rows.length}</span>
              </h3>
              {group.rows.length === 0 ? (
                <p className="rounded-card border border-line bg-ink-850 px-4 py-3 text-sm text-fg-3">{ROSTER.emptyRole[group.role as 'tank' | 'healer' | 'dps']}</p>
              ) : (
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
              )}
            </div>
          ))}
          <RosterLists raidId={raidId} noResponse={noResponse} absent={absent} canAnswerFor={canAnswerFor} officer={officer} posted={posted} open={open} />
        </>
      )}
    </section>
  );
}

function Row({ raidId, row, at, canAnswerFor, showAttendance }: { raidId: string; row: DetailRow; at: Date; canAnswerFor: boolean; showAttendance: boolean }) {
  const color = row.wowClass ? CLASS_COLORS[row.wowClass].onInk : undefined;
  const meta = row.wowClass ? [row.character, CLASS_COLORS[row.wowClass].label, row.spec].filter(Boolean).join(' · ') : UNKNOWN_MAIN;
  return (
    <li className={cn('flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2', row.response === 'absent' && 'opacity-60')}>
      <ClassAvatar name={row.name} wowClass={row.wowClass} />
      <div className="flex min-w-0 basis-[calc(100%-36px)] flex-col md:flex-1 md:basis-0">
        <span className="text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color }}>
          {row.name}
        </span>
        <span className="text-small text-fg-3 [overflow-wrap:anywhere]">{meta}</span>
        {row.response === 'absent' && row.reason && (
          <span className="text-small italic text-fg-2 [overflow-wrap:anywhere]">
            {ROSTER.reasonPrefix} “{row.reason}”
          </span>
        )}
      </div>
      {/* Phones: the answer details wrap under the name, indented past the avatar. */}
      <div className="ml-9 flex w-[calc(100%-36px)] flex-wrap items-center gap-x-3 gap-y-1 md:ml-0 md:w-auto md:flex-nowrap">
        <div className="md:w-[132px]">
          {canAnswerFor ? (
            <AnswerFor raidId={raidId} userId={row.userId} name={row.name} current={row.response} />
          ) : (
            <span className={cn('text-sm font-semibold', row.response ? ANSWER_TONE[row.response] : 'text-fg-3')}>{row.response ? ANSWER_LABEL[row.response] : ROSTER.noAnswer}</span>
          )}
          {showAttendance && row.attended !== null && <span className={cn('block text-small', row.attended ? 'text-ok' : 'text-fg-3')}>{row.attended ? ROSTER.attended : ROSTER.missed}</span>}
        </div>
        <div className="empty:hidden md:w-28 md:empty:block">
          {row.response === null ? null : row.setBy ? (
            <span className="text-small text-fg-3">
              {SET_BY} <span className="font-semibold text-fg-2">{row.setBy}</span>
            </span>
          ) : (
            <SourceBadge source={row.source} />
          )}
        </div>
        <time dateTime={row.updatedAt} className="text-small text-fg-3 empty:hidden md:w-20 md:text-right md:empty:block">
          {row.response === null ? '' : relativeDate(new Date(row.updatedAt), at)}
        </time>
      </div>
    </li>
  );
}
