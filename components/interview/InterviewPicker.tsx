'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { TimezoneDialog } from '@/components/time/TimezoneDialog';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, Modal } from '@/components/ui';
import { INTERVIEW } from '@/content/interview';
import { cn } from '@/lib/cn';
import { GUILD_TIMEZONE } from '@/lib/config';
import { pickerStarts } from '@/lib/interview-slots';
import { formatClock, formatLongDate, formatRange, tzOffsetMs, zonedParts, zonedTimeToUtc, zoneAbbreviation } from '@/lib/time';
import { hourButtons, hourRuns, pickerDays, pickerSummary, zoneLabel, type PickerDay } from './picker';
import { DayStrip, MonthCalendar } from './PickerCalendar';

const { pick: COPY } = INTERVIEW;

const TEXT_BUTTON = 'flex min-h-11 items-center font-semibold text-teal underline decoration-teal-dim underline-offset-4';
const META = 'flex min-h-[34px] items-center gap-2.5 text-sm text-fg-2 max-[959px]:min-h-7 max-[959px]:gap-[7px] max-[959px]:text-[13px]';

const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="shrink-0 text-fg-3" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

/** Does `zone` keep the same clock as guild time across the picker's window? */
function sameClockAsGuild(zone: string, starts: number[]): boolean {
  return [starts[0], starts.at(-1)].every((t) => t === undefined || tzOffsetMs(new Date(t), zone) === tzOffsetMs(new Date(t), GUILD_TIMEZONE));
}

/**
 * The time picker (approved design 367, revision 2, version G): the hours an applicant could
 * start an interview, as one-hour buttons on a day of the month calendar. Local state only; a
 * later part sends the picks. `initial` is the starts to open with.
 */
export function InterviewPicker({ requestedAt, now, name, initial = [] }: { requestedAt: string; now: string; name: string; initial?: string[] }) {
  const viewer = useViewerTimeZone();
  const starts = useMemo(() => pickerStarts(new Date(requestedAt), new Date(now)).map((d) => d.getTime()), [requestedAt, now]);
  // Starts already sent, if any; ones the window no longer offers are dropped.
  const [picks, setPicks] = useState<ReadonlySet<number>>(() => new Set(initial.map((s) => Date.parse(s)).filter((t) => starts.includes(t))));
  const [pickAt, setPickAt] = useState<number | null>(null);
  const [showGuild, setShowGuild] = useState(false);
  const [month, setMonth] = useState<{ year: number; month: number } | null>(null);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pickAllRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  // After Clear all, the picked hours (and the button that opened the dialog) are gone: focus Pick all instead.
  useEffect(() => {
    if (!confirmOpen && refocus.current) {
      refocus.current = false;
      pickAllRef.current?.focus();
    }
  }, [confirmOpen]);

  const zone = viewer?.zone ?? GUILD_TIMEZONE;
  const guildClock = sameClockAsGuild(zone, starts);
  const shownZone = showGuild || guildClock ? GUILD_TIMEZONE : zone;
  const days = pickerDays(starts, shownZone);
  const isPicked = (hour: number[]) => hour.every((t) => picks.has(t));
  const pickedOn = new Map(days.map((d) => [d.key, hourButtons(d.starts, shownZone).filter(isPicked).length]));
  const current = days.find((d) => pickAt !== null && d.key === pickerDays([pickAt], shownZone)[0].key) ?? days.find((d) => pickedOn.get(d.key)) ?? days[0];
  const summary = pickerSummary(picks);

  const toggle = (toggled: number[]) =>
    setPicks((before) => {
      const next = new Set(before);
      const on = toggled.every((t) => before.has(t));
      for (const t of toggled) {
        if (on) next.delete(t);
        else next.add(t);
      }
      return next;
    });
  const choose = (day: PickerDay) => {
    setPickAt(day.starts[0]);
    setMonth(null);
  };
  const monthOf = (day: PickerDay) => ({ year: day.year, month: day.month });

  const info = (
    <div className="flex flex-col gap-3 p-7 max-[959px]:gap-2.5 max-[959px]:px-5 max-[959px]:pb-3 max-[959px]:pt-5 max-[599px]:px-4 max-[599px]:pb-2 max-[599px]:pt-4">
      <Image src="/brand/mark.png" alt="" width={42} height={48} className="w-8 opacity-40 max-[959px]:hidden" />
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{INTERVIEW.eyebrow}</span>
      <h1 className="font-display text-[30px] font-medium leading-[1.1] tracking-[-0.015em] max-[959px]:text-[28px]">{COPY.title}</h1>
      <p className="text-sm leading-[1.65] text-fg-2 max-[959px]:text-[13px] max-[959px]:leading-[1.6]">{COPY.body}</p>
      <ul className="mt-1 flex flex-col max-[959px]:mt-0 max-[959px]:flex-row max-[959px]:flex-wrap max-[959px]:gap-x-4">
        <li className={META}>
          <Icon>
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 4.5V8l2.5 1.5" />
          </Icon>
          <span>{COPY.length}</span>
        </li>
        <li className={META}>
          <Icon>
            <rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25" />
            <path d="M3.25 7.5a4.75 4.75 0 0 0 9.5 0M8 12.25v2" />
          </Icon>
          <span>{COPY.where}</span>
        </li>
        {starts.length > 0 && (
          <li className={META}>
            <Icon>
              <rect x="2" y="3" width="12" height="11" rx="1.5" />
              <path d="M2 6.5h12M5 1.5v3M11 1.5v3" />
            </Icon>
            <span>
              {COPY.startTimes} <GuildHours first={starts[0]} />
            </span>
          </li>
        )}
        <li className={cn(META, 'max-[959px]:basis-full max-[959px]:min-h-11')}>
          <Icon>
            <circle cx="8" cy="8" r="6.25" />
            <path d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 4 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.25 5.4 8S6.2 3.65 8 1.75z" />
          </Icon>
          {viewer ? (
            <button type="button" onClick={() => setZoneOpen(true)} aria-label={COPY.zoneButton(zoneLabel(zone, new Date(starts[0] ?? now)))} className="inline-flex min-h-11 items-center gap-1.5 text-left font-semibold text-teal transition-[filter] hover:brightness-110">
              {zoneLabel(zone, new Date(starts[0] ?? now))}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 5l4 4 4-4" />
              </svg>
            </button>
          ) : (
            <span>{COPY.detecting}</span>
          )}
        </li>
        <li className={cn(META, 'max-[599px]:hidden')}>
          <Icon>
            <circle cx="8" cy="5.5" r="2.75" />
            <path d="M2.75 14c.6-2.6 2.7-4.25 5.25-4.25s4.65 1.65 5.25 4.25" />
          </Icon>
          <span>{COPY.signedInAs(name)}</span>
        </li>
      </ul>
    </div>
  );

  return (
    <div className="flex flex-1 items-stretch justify-center min-[600px]:items-center min-[600px]:px-4 min-[600px]:pb-14 min-[600px]:pt-6 min-[960px]:px-6 min-[960px]:pb-[72px] min-[960px]:pt-8">
      <div className="w-full max-w-[560px] min-[600px]:rounded-card min-[600px]:border min-[600px]:border-line min-[600px]:bg-ink-850 min-[960px]:max-w-[1040px]">
        {current ? (
          <div className="flex flex-col min-[960px]:grid min-[960px]:h-[600px] min-[960px]:grid-cols-[300px_380px_1fr]">
            <div className="min-[960px]:overflow-y-auto">{info}</div>
            <div className="hidden min-h-0 border-l border-line min-[960px]:block">
              <MonthCalendar days={days} current={current} zone={shownZone} picked={pickedOn} onPick={choose} month={month ?? monthOf(current)} onMonth={(step) => setMonth((m) => stepMonth(m ?? monthOf(current), step))} />
            </div>
            <div className="min-[960px]:hidden">
              <DayStrip days={days} current={current} zone={shownZone} picked={pickedOn} onPick={choose} />
            </div>
            <DayPanel
              day={current}
              zone={zone}
              shownZone={shownZone}
              picks={picks}
              picked={pickedOn.get(current.key) ?? 0}
              guildClock={guildClock}
              showGuild={showGuild}
              onShowGuild={(guild) => {
                setPickAt(current.starts[0]);
                setShowGuild(guild);
                setMonth(null);
              }}
              onToggle={toggle}
              pickAllRef={pickAllRef}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-7">
            {info}
            <p className="px-7 pb-7 text-sm text-fg-2">{COPY.noTimes}</p>
          </div>
        )}
        <div className="z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-ink-900 px-4 py-3 min-[600px]:rounded-b-card min-[600px]:px-5 max-[959px]:sticky max-[959px]:bottom-0">
          <span className={cn('flex items-center gap-2 text-[13px] max-[959px]:min-w-0 max-[959px]:flex-[1_1_160px] max-[959px]:text-xs', summary.tone === 'warn' ? 'text-warn' : 'text-fg-3')}>
            <span aria-hidden className={cn('h-[7px] w-[7px] shrink-0 rounded-full', summary.tone === 'warn' ? 'bg-warn' : 'bg-fg-3')} />
            <span role="status">{summary.text}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            {picks.size > 0 && (
              <button type="button" onClick={() => setConfirmOpen(true)} className={cn(TEXT_BUTTON, 'mr-1 text-sm')}>
                {COPY.clearAll}
              </button>
            )}
            {/* Part 4 sends the picks; until then an open Send does nothing. */}
            <Button disabled={!summary.canSend} className="font-bold">
              {COPY.send}
            </Button>
          </span>
        </div>
      </div>

      <TimezoneDialog open={zoneOpen} onClose={() => setZoneOpen(false)} />
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={COPY.confirm.title}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {COPY.confirm.keep}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                refocus.current = true;
                setPicks(new Set());
                setConfirmOpen(false);
              }}
            >
              {COPY.confirm.clear}
            </Button>
          </>
        }
      >
        <p className="pb-2">{COPY.confirm.body}</p>
      </Modal>
    </div>
  );
}

function stepMonth(m: { year: number; month: number }, step: -1 | 1) {
  const index = m.year * 12 + (m.month - 1) + step;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** "12:00 PM – 1:30 AM EDT": the guild's 9:00 AM to 10:30 PM on the window's first day, in the viewer's zone. */
function GuildHours({ first }: { first: number }) {
  const p = zonedParts(new Date(first), GUILD_TIMEZONE);
  const open = zonedTimeToUtc(p.year, p.month, p.day, 9, 0, GUILD_TIMEZONE);
  return <LocalTime startsAt={open.toISOString()} durationMin={13.5 * 60} className="text-sm font-normal text-fg-2" />;
}

type PanelProps = {
  day: PickerDay;
  zone: string;
  shownZone: string;
  picks: ReadonlySet<number>;
  picked: number;
  guildClock: boolean;
  showGuild: boolean;
  onShowGuild: (guild: boolean) => void;
  onToggle: (starts: number[]) => void;
  pickAllRef: React.RefObject<HTMLButtonElement | null>;
};

/** One day's bookable hours as toggle buttons, three to a row, with a dashed break where the day has a gap. */
function DayPanel({ day, zone, shownZone, picks, picked, guildClock, showGuild, onShowGuild, onToggle, pickAllRef }: PanelProps) {
  const at = new Date(day.starts[0]);
  const runs = hourRuns(hourButtons(day.starts, shownZone));
  const all = day.starts.every((t) => picks.has(t));
  const inGuild = shownZone === GUILD_TIMEZONE;
  const range = (hour: number[], z: string) => formatRange(new Date(hour[0]), new Date(hour.at(-1)! + 30 * 60_000), z);
  const name = (hour: number[]) => {
    const start = new Date(hour[0]);
    const guild = `${range(hour, GUILD_TIMEZONE)} guild time (${zoneAbbreviation(start, GUILD_TIMEZONE)})`;
    if (guildClock) return COPY.guildOnlyHourLabel(guild);
    return COPY.hourLabel(`${range(hour, zone)} ${zoneAbbreviation(start, zone)}`, guild, showGuild);
  };
  const segment = (guild: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={showGuild === guild}
      onClick={() => onShowGuild(guild)}
      className={cn(
        "relative h-9 rounded-[3px] px-2.5 text-xs font-semibold transition-colors duration-[120ms] after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
        showGuild === guild ? cn('bg-ink-700', guild ? 'text-sand' : 'text-teal') : 'text-fg-3 hover:text-fg-2',
      )}
    >
      {label}
    </button>
  );
  const pad = 'px-4 min-[600px]:px-5';
  return (
    <div className="flex min-h-0 flex-col border-line min-[960px]:h-full min-[960px]:border-l">
      <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-1.5 pt-3 min-[960px]:pt-5', pad)}>
        <h2 className="text-[15px] font-semibold">{formatLongDate(at, shownZone)}</h2>
        {!guildClock && (
          <div role="group" aria-label={COPY.switchLabel} className="inline-flex gap-0.5 rounded-control border border-line-strong p-0.5">
            {segment(false, COPY.yourTime)}
            {segment(true, COPY.guildTime)}
          </div>
        )}
      </div>
      <div className={cn('flex items-center justify-between gap-3 pb-2 text-xs text-fg-3', pad)}>
        <span>
          {picked > 0 && `${COPY.pickedOnDay(picked)} · `}
          {COPY.hoursIn(inGuild ? `guild time (${zoneAbbreviation(at, GUILD_TIMEZONE)})` : zoneAbbreviation(at, zone))}
        </span>
        <button ref={pickAllRef} type="button" onClick={() => onToggle(day.starts)} className={cn(TEXT_BUTTON, '-my-1')}>
          {all ? COPY.clearDay : COPY.pickAll}
        </button>
      </div>
      <div className={cn('pb-5 pt-1 min-[960px]:min-h-0 min-[960px]:flex-1 min-[960px]:overflow-y-auto', pad)}>
        <p className="mb-2.5 text-xs text-fg-3">{COPY.note}</p>
        {runs.map((run, i) => (
          <div key={run[0][0]} className={cn('grid grid-cols-3 gap-2', i > 0 && 'mt-3.5 border-t border-dashed border-line-strong pt-3.5')}>
            {run.map((hour) => {
              const on = hour.every((t) => picks.has(t));
              return (
                <button
                  key={hour[0]}
                  type="button"
                  aria-pressed={on}
                  aria-label={name(hour)}
                  onClick={() => onToggle(hour)}
                  className={cn(
                    'tabular flex h-11 items-center justify-center gap-[5px] rounded-control border text-sm font-semibold transition-colors duration-[120ms]',
                    on ? 'border-slot-available bg-slot-available text-white' : 'border-line-strong text-fg hover:border-teal-dim hover:bg-ink-800',
                  )}
                >
                  {on && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M2.5 6.5l2.3 2.3 4.7-5" />
                    </svg>
                  )}
                  {formatClock(new Date(hour[0]), shownZone)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
