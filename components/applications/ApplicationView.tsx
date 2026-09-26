import { ClassAvatar, StatusPill, Tag } from '@/components/ui';
import { orderedAnswers, PATH_LABEL, STATUS_LABEL, STATUS_TONE } from '@/lib/applications-inbox';
import type { ApplicationDetail } from '@/lib/applications-data';
import { rolesOfSpec } from '@/lib/class-needs';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { formatGuildRangeShort, relativeDate, WEEKDAY_NAMES } from '@/lib/time';
import { DETAIL } from '@/content/applications';
import { RAID_NIGHTS } from '@/content/schedule';
import { NightsLocal } from './NightsLocal';

type Props = { app: ApplicationDetail; now: string };

const PROGRESSION = RAID_NIGHTS.filter((n) => !n.optional);

/**
 * docs/04 § Application detail: head with the character in class colour and the meta row,
 * one block per answer, the logs link with its host visible, the availability answer with
 * guild and local times, then the private officer notes. Decisions and the note composer
 * arrive with the next PR; this renders what was submitted.
 */
export function ApplicationView({ app, now }: Props) {
  const at = new Date(now);
  const color = app.wowClass ? CLASS_COLORS[app.wowClass].onInk : undefined;
  const answers = orderedAnswers(app.answers);
  const roles = app.wowClass && app.spec ? rolesOfSpec(app.wowClass, app.spec).map((r) => ROLE_LABELS[r]).join(' / ') : null;
  const meta = [app.wowClass ? CLASS_COLORS[app.wowClass].label : null, app.spec, roles].filter(Boolean).join(' · ');
  const host = app.logsUrl ? safeHost(app.logsUrl) : null;

  return (
    <article className="flex flex-col gap-6" aria-labelledby="application-title">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <ClassAvatar name={app.character} wowClass={app.wowClass} size={32} />
          <h2 id="application-title" className="font-display text-[30px] font-medium leading-none" style={{ color }}>
            {app.character}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-3">
          {meta && <span>{meta}</span>}
          <Tag>{PATH_LABEL[app.path]}</Tag>
          <span>
            {DETAIL.submitted} <time dateTime={app.createdAt}>{relativeDate(new Date(app.createdAt), at)}</time>
          </span>
          <StatusPill tone={STATUS_TONE[app.status]}>{app.status === 'pending' ? STATUS_LABEL.pending : DETAIL.decided(STATUS_LABEL[app.status], app.decidedBy)}</StatusPill>
        </div>
        <p className="text-sm text-fg-2">
          <span className="text-fg-3">Discord </span>
          <span className="font-semibold text-fg">{app.discordName}</span>
          {!app.discordId && <span className="text-fg-3"> · {DETAIL.noAccount}</span>}
        </p>
      </header>

      <dl className="flex flex-col divide-y divide-line-faint border-t border-line-faint">
        {app.logsUrl && host && (
          <div className="flex flex-col gap-1.5 py-4">
            <dt className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{DETAIL.logs}</dt>
            <dd>
              <a href={app.logsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all text-teal-text underline-offset-4 hover:underline">
                {host}
                <span className="text-fg-3"> ↗</span>
              </a>
            </dd>
          </div>
        )}
        {answers.map((a) => (
          <div key={a.key} className="flex flex-col gap-1.5 py-4">
            <dt className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{a.label}</dt>
            <dd className="whitespace-pre-line text-[15px] leading-[1.65]">{a.answer}</dd>
            {a.key === 'availability' && (
              <dd className="tabular text-sm text-fg-3">
                {DETAIL.guildTime} {PROGRESSION.map((n) => WEEKDAY_NAMES[n.day]).join(' and ')}, {formatGuildRangeShort(PROGRESSION[0].start, PROGRESSION[0].end)} guild
                <NightsLocal night={PROGRESSION[0]} />
              </dd>
            )}
          </div>
        ))}
        {answers.length === 0 && !app.logsUrl && <p className="py-4 text-sm text-fg-3">{DETAIL.noAnswers}</p>}
      </dl>

      <section className="flex flex-col gap-3 rounded-card border border-line bg-ink-800 p-4" aria-labelledby="officer-notes">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="officer-notes" className="text-label font-semibold uppercase tracking-[0.12em] text-fg-2">
            {DETAIL.notes}
          </h3>
          <span className="text-xs text-fg-3">{DETAIL.notesPrivate}</span>
        </div>
        {app.notes.length === 0 ? (
          <p className="text-sm text-fg-3">{DETAIL.noNotes}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {app.notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3">
                <ClassAvatar name={n.author} wowClass={n.authorClass} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold" style={{ color: n.authorClass ? CLASS_COLORS[n.authorClass].onInk : undefined }}>
                      {n.author}
                    </span>
                    <time dateTime={n.createdAt} className="text-xs text-fg-3">
                      {relativeDate(new Date(n.createdAt), at)}
                    </time>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-[1.6] text-fg-2">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}

function safeHost(url: string): string | null {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.host : null;
  } catch {
    return null;
  }
}
