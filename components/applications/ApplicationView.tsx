import { ClassAvatar, SourceBadge, StatusPill, Tag, ToastHost } from '@/components/ui';
import { orderedAnswers, PATH_LABEL, STATUS_LABEL, STATUS_TONE } from '@/lib/applications-inbox';
import type { ApplicationDetail } from '@/lib/applications-data';
import { rolesOfSpec } from '@/lib/class-needs';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { relativeDate } from '@/lib/time';
import { DETAIL } from '@/content/applications';
import { DecisionBar } from './DecisionBar';
import { NoteComposer } from './NoteComposer';

type Props = {
  app: ApplicationDetail;
  now: string;
  threadUrl?: string | null;
  /** In the inbox pane: the application's own page, offered in a new window. Absent on that page itself. */
  standaloneUrl?: string | null;
};

/**
 * docs/04 § Application detail: head with the applicant's Discord name in class colour,
 * the meta row and their character, one block per answer, the logs link with its host
 * visible, then the private officer notes with their composer, and the decision bar
 * pinned to the bottom while the application is pending.
 */
export function ApplicationView({ app, now, threadUrl = null, standaloneUrl = null }: Props) {
  const at = new Date(now);
  const color = app.wowClass ? CLASS_COLORS[app.wowClass].onInk : undefined;
  const answers = orderedAnswers(app.answers);
  const roles = app.wowClass && app.spec ? rolesOfSpec(app.wowClass, app.spec).map((r) => ROLE_LABELS[r]).join(' / ') : null;
  const meta = [app.wowClass ? CLASS_COLORS[app.wowClass].label : null, app.spec, roles].filter(Boolean).join(' · ');
  const host = app.logsUrl ? safeHost(app.logsUrl) : null;

  return (
    <ToastHost>
      <article className="flex flex-col gap-6" aria-labelledby="application-title">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <ClassAvatar name={app.discordName} wowClass={app.wowClass} size={32} />
            <h2 id="application-title" className="font-display text-[30px] font-medium leading-none" style={{ color }}>
              {app.discordName}
            </h2>
            {standaloneUrl && (
              <a href={standaloneUrl} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex min-h-11 items-center gap-1 text-sm text-fg-3 underline-offset-4 hover:text-fg hover:underline">
                {DETAIL.openWindow} <span aria-hidden>↗</span>
              </a>
            )}
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
            <span className="text-fg-3">{DETAIL.character} </span>
            <span className="font-semibold text-fg">{app.character}</span>
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
            </div>
          ))}
          {answers.length === 0 && !app.logsUrl && <p className="py-4 text-sm text-fg-3">{DETAIL.noAnswers}</p>}
        </dl>

        <section className="flex flex-col gap-3 rounded-card border border-line bg-ink-800 p-4" aria-labelledby="officer-notes">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id="officer-notes" className="text-label font-semibold uppercase tracking-[0.12em] text-fg-2">
              {DETAIL.notes}
              {app.discordThreadId && <span className="ml-2 font-normal normal-case tracking-normal text-fg-3">· {DETAIL.notesSynced}</span>}
            </h3>
            <span className="flex items-center gap-3 text-xs text-fg-3">
              {DETAIL.notesPrivate}
              {threadUrl && (
                <a href={threadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-teal-text underline-offset-4 hover:underline">
                  {DETAIL.openThread} ↗
                </a>
              )}
            </span>
          </div>
          {app.notes.length === 0 ? (
            <p className="text-sm text-fg-3">{DETAIL.noNotes}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {app.notes.map((n) => (
                <li key={n.id} className="flex min-h-11 items-start gap-3">
                  <ClassAvatar name={n.author} wowClass={n.authorClass} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold" style={{ color: n.authorClass ? CLASS_COLORS[n.authorClass].onInk : undefined }}>
                        {n.author}
                      </span>
                      <SourceBadge source={n.source} />
                      <time dateTime={n.createdAt} className="text-xs text-fg-3">
                        {relativeDate(new Date(n.createdAt), at)}
                        {n.editedAt && ` · ${DETAIL.edited}`}
                      </time>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-[1.6] text-fg-2">{n.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <NoteComposer applicationId={app.id} />
        </section>

        <DecisionBar id={app.id} name={app.discordName} path={app.path} pending={app.status === 'pending'} />
      </article>
    </ToastHost>
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
