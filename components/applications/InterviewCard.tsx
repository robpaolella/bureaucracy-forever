'use client';

import { Fragment, type ReactNode } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { StatusPill, type StatusTone } from '@/components/ui';
import { INTERVIEW } from '@/content/applications';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { InterviewCard as Card } from '@/lib/interviews';

const HALF_HOUR_MS = 30 * 60_000;
type Status = Card['status'];

const TONE: Record<Status, StatusTone> = { AWAITING_TIMES: 'closed', TIMES_RECEIVED: 'warn', PROPOSED: 'warn', BOOKED: 'ok', DONE: 'ok', NO_TIME: 'stop', CANCELLED: 'closed', CLOSED: 'closed' };
/** The states that list the applicant's times. */
const SHOWS_TIMES: Status[] = ['TIMES_RECEIVED', 'PROPOSED', 'NO_TIME'];

/** "Friday 16 Oct" in `zone`. */
function dayLabel(at: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'short' }).formatToParts(new Date(at));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('weekday')} ${get('day')} ${get('month')}`;
}

/** Consecutive half-hours become one range; ranges are grouped by their day in `zone`. */
export function timesByDay(slots: string[], zone: string): { day: string; ranges: { start: string; minutes: number }[] }[] {
  const days: { day: string; ranges: { start: string; minutes: number }[] }[] = [];
  let previous: number | null = null;
  for (const slot of [...slots].sort()) {
    const t = new Date(slot).getTime();
    const day = dayLabel(slot, zone);
    let group = days.find((d) => d.day === day);
    if (!group) days.push((group = { day, ranges: [] }));
    const last = group.ranges[group.ranges.length - 1];
    // Joins only when the previous slot is the one just before this one, in this same day.
    if (last && previous !== null && t - previous === HALF_HOUR_MS && group === days[days.length - 1]) last.minutes += 30;
    else group.ranges.push({ start: slot, minutes: 30 });
    previous = t;
  }
  return days;
}

function fill(template: string, pieces: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => <Fragment key={i}>{part in pieces ? pieces[part] : part}</Fragment>);
}

/** Read-only summary of an application's interview. Booking and cancelling happen in Discord. */
export function InterviewCard({ card, applicant, threadUrl = null }: { card: Card; applicant: string; threadUrl?: string | null }) {
  const zone = useViewerTimeZone()?.zone ?? GUILD_TIMEZONE;
  const who = (name: string | null) => <b className="font-semibold text-fg">{name ?? INTERVIEW.anOfficer}</b>;
  const plain = (name: string | null) => name ?? INTERVIEW.anOfficer;
  const when = (at: string | null, strong = false) => at && (
    <span>
      <span className="tabular">{dayLabel(at, zone)}, </span>
      <LocalTime startsAt={at} durationMin={0} weekday="guild" className={strong ? undefined : 'font-normal'} />
    </span>
  );
  const day = (at: string | null) => at && <span className="tabular">{dayLabel(at, zone)}</span>;
  const sent = card.slots.length ? INTERVIEW.halfHours(card.slots.length) : null;

  const pieces = (extra: Record<string, ReactNode> = {}): Record<string, ReactNode> => ({
    '{who}': who(card.requestedBy), '{when}': when(card.requestedAt), '{end}': when(card.windowEnd), ...extra,
  });
  const line = ((): ReactNode => {
    switch (card.status) {
      case 'AWAITING_TIMES':
        return fill(card.attempt > 1 ? INTERVIEW.second(applicant) : INTERVIEW.awaiting(applicant), pieces());
      case 'TIMES_RECEIVED':
        return fill(INTERVIEW.received(applicant, sent ?? INTERVIEW.halfHours(0), plain(card.requestedBy)), pieces({ '{when}': when(card.timesUpdatedAt ?? card.requestedAt) }));
      case 'PROPOSED':
        return fill(INTERVIEW.proposed(applicant), pieces({ '{who}': who(card.proposedBy), '{when}': when(card.proposedStart, true) }));
      case 'BOOKED':
        return fill(INTERVIEW.booked(), pieces({ '{who}': who(card.bookedBy), '{when}': when(card.bookedStart, true) }));
      case 'DONE':
        return fill(INTERVIEW.done(plain(card.bookedBy)), pieces({ '{when}': when(card.bookedStart) }));
      case 'NO_TIME': {
        if (card.endReason === 'EXPIRED') return fill(INTERVIEW.expired(applicant), pieces());
        const lapsed = card.endReason === 'PROPOSAL_LAPSED';
        return fill((lapsed ? INTERVIEW.lapsed : INTERVIEW.declined)(applicant, plain(card.proposedBy)), pieces({ '{when}': when(card.proposedStart) }));
      }
      case 'CANCELLED': {
        // Cancelled before anyone booked: there is no booked time to name.
        const base = card.endedBy ? INTERVIEW.cancelled() : INTERVIEW.cancelledUnknown();
        return fill(base + (card.bookedStart ? INTERVIEW.wasBooked : ''), pieces({ '{who}': who(card.endedBy), '{day}': day(card.endedAt), '{when}': when(card.bookedStart) }));
      }
      case 'CLOSED':
        return INTERVIEW.closed(applicant, sent);
    }
  })();
  const times = SHOWS_TIMES.includes(card.status) ? timesByDay(card.slots, zone) : [];

  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-ink-800 p-4" aria-labelledby="interview-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h3 id="interview-card" className="text-label font-semibold uppercase tracking-[0.12em] text-fg-2">{INTERVIEW.title}</h3>
          <StatusPill tone={TONE[card.status]}>{INTERVIEW.words[card.status]}</StatusPill>
        </div>
        {threadUrl && (
          <a href={threadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-teal-text underline-offset-4 hover:underline">
            {INTERVIEW.openThread} ↗
          </a>
        )}
      </div>
      <p className="text-sm leading-[1.6] text-fg-2">{line}</p>
      {times.length > 0 && (
        <ul className="flex flex-col divide-y divide-line-faint border-t border-line-faint">
          {times.map((d) => (
            <li key={d.day} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
              <span className="text-sm text-fg-3 sm:w-40 sm:shrink-0">{d.day}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                {d.ranges.map((r) => <LocalTime key={r.start} startsAt={r.start} durationMin={r.minutes} weekday="guild" />)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {card.earlier && <p className="text-[13px] text-fg-3">{fill(INTERVIEW.earlier(INTERVIEW.words[card.earlier.status]), { '{day}': day(card.earlier.at) })}</p>}
      <span className="text-xs text-fg-3">{INTERVIEW.actionsNote}</span>
    </section>
  );
}
