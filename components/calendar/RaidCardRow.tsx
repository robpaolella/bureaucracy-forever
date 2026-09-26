'use client';

import { DualTime } from '@/components/time/DualTime';
import { SegmentedControl } from '@/components/ui';
import { cn } from '@/lib/cn';
import { GUILD_TIMEZONE } from '@/lib/config';
import { ROLE_SHORT, ROLES } from '@/lib/design/class-colors';
import { countTone, type RaidCard, type RaidResponse } from '@/lib/raids';
import { zonedParts } from '@/lib/time';

type Props = {
  raid: RaidCard;
  tonight: boolean;
  /** Socials and the logged-out see the card without the response control. */
  canRespond: boolean;
  past: boolean;
  onRespond: (response: RaidResponse) => void;
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TONE_TEXT = { ok: 'text-fg', warn: 'text-warn', stop: 'text-stop' } as const;

const RESPONSE_OPTIONS = [
  { value: 'accept', label: 'Accept', tone: 'ok' },
  { value: 'tentative', label: 'Tentative', tone: 'warn' },
  { value: 'absent', label: 'Absent', tone: 'stop' },
] as const;

/**
 * One raid (docs/04 § Raid calendar § Rows): a 56px date block in guild time, the name
 * and dual time, four role stacks that turn warn below the requirement and stop at zero,
 * and the viewer's three-way response. Tonight's raid takes a sand-dim border and eyebrow.
 */
export function RaidCardRow({ raid, tonight, canRespond, past, onRespond }: Props) {
  const p = zonedParts(new Date(raid.startsAt), GUILD_TIMEZONE);
  return (
    <li className={cn('flex flex-col gap-4 rounded-card border bg-ink-850 p-5 md:flex-row md:items-center md:gap-6', tonight ? 'border-sand-dim' : 'border-line', raid.cancelled && 'opacity-60')}>
      <div className="flex items-center gap-4 md:flex-1">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-control border border-line bg-ink-900 py-2" aria-hidden>
          <span className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{MONTH_SHORT[p.month - 1]}</span>
          <span className="tabular font-display text-[28px] font-medium leading-none">{p.day}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          {tonight && <span className="font-eyebrow text-[10px] font-semibold uppercase tracking-[0.28em] text-sand">Tonight</span>}
          <h2 className="text-[17px] font-semibold">
            {raid.name}
            {raid.cancelled && <span className="ml-2 text-sm font-normal text-stop">Cancelled</span>}
          </h2>
          <DualTime startsAt={raid.startsAt} durationMin={raid.durationMin} />
        </div>
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 md:shrink-0" aria-label="Accepted by role">
        {ROLES.map((r) => {
          const tone = countTone(raid.counts[r], raid.requirements[r]);
          return (
            <div key={r} className="flex items-baseline gap-1.5 text-sm">
              <dt className="text-fg-3" aria-label={r}>
                {ROLE_SHORT[r]}
              </dt>
              <dd className={cn('tabular font-semibold transition-colors duration-[120ms]', TONE_TEXT[tone])}>
                {raid.counts[r]}
                <span className="sr-only"> of {raid.requirements[r]} needed</span>
              </dd>
            </div>
          );
        })}
      </dl>

      {canRespond && !past && !raid.cancelled && (
        <SegmentedControl label={`Your response to ${raid.name}`} value={raid.mine} onChange={onRespond} options={RESPONSE_OPTIONS} fill className="md:w-auto md:shrink-0 md:[&>button]:flex-none" />
      )}
      {canRespond && (past || raid.cancelled) && raid.mine && (
        <span className="text-sm text-fg-3 md:shrink-0">
          You answered <span className="font-semibold text-fg-2">{raid.mine}</span>
        </span>
      )}
    </li>
  );
}
