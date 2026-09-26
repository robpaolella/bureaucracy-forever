'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { ScheduleRaidModal } from '@/components/raid/ScheduleRaidModal';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, EmptyState, SegmentedControl, Toast, type ToastData } from '@/components/ui';
import type { Role } from '@/lib/design/class-colors';
import { isTonight, isUpcoming, raidWeekday, responseToast, type RaidCard, type RaidInput, type RaidResponse } from '@/lib/raids';
import { AVAILABILITY_PROMPT, CALENDAR_EMPTY, CALENDAR_PAST_EMPTY, SAVE_FAILED, SCHEDULE_RAID, scheduledToast } from '@/content/calendar';
import { RaidCardRow } from './RaidCardRow';
import { useSignup } from './useSignup';

type Scope = 'upcoming' | 'past';

type Props = {
  raids: RaidCard[];
  viewer: { role: 'social' | 'member' | 'officer'; raidRole: Role | null; availabilitySubmitted: boolean };
  /** Officers only: the blank (or window-prefilled) form, and whether `?new=1` asked for it open. */
  schedule?: { initial: RaidInput; openOnLoad: boolean };
};

/**
 * docs/04 § Raid calendar: a list, not a month grid. Upcoming / Past control, one card per
 * raid with the viewer's response written optimistically, tonight pinned first, the toast
 * with Undo, and the one-line availability prompt for members who have not painted yet.
 */
export function CalendarList({ raids: initial, viewer, schedule }: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [toast, setToast] = useState<ToastData | null>(null);
  const [scheduling, setScheduling] = useState(Boolean(schedule?.openOnLoad));
  const zone = useViewerTimeZone();
  const now = useMemo(() => new Date(), []);

  const closeSchedule = useCallback(() => {
    setScheduling(false);
    if (schedule?.openOnLoad) router.replace('/members/calendar');
  }, [router, schedule?.openOnLoad]);
  const onScheduled = useCallback(
    (raid: { id: string; name: string; startsAt: string }) => {
      closeSchedule();
      setToast({ tone: 'ok', title: scheduledToast(raid.name, raidWeekday(raid.startsAt)), detail: responseToast(raid, null, zone?.zone ?? null).detail });
      router.refresh();
    },
    [closeSchedule, router, zone],
  );

  const onResult = useCallback(
    (ok: boolean, raid: RaidCard, response: RaidResponse | null, undo: () => void) => {
      if (!ok) {
        setToast({ tone: 'stop', title: SAVE_FAILED });
        return;
      }
      const copy = responseToast(raid, response, zone?.zone ?? null);
      setToast({ tone: 'ok', title: copy.title, detail: copy.detail, action: { label: 'Undo', onClick: undo } });
    },
    [zone],
  );
  const { raids, respond } = useSignup(initial, viewer.raidRole, onResult);

  const canRespond = viewer.role !== 'social';
  const upcoming = useMemo(() => raids.filter((r) => isUpcoming(r, now)), [raids, now]);
  const past = useMemo(() => raids.filter((r) => !isUpcoming(r, now)).reverse(), [raids, now]);
  const shown = scope === 'upcoming' ? upcoming : past;
  const tonightId =
    zone && scope === 'upcoming' ? upcoming.find((r) => isTonight(r.startsAt, now, zone.zone))?.id : undefined;
  const tonightRaid = tonightId ? shown.find((r) => r.id === tonightId) : undefined;
  const ordered = tonightRaid ? [tonightRaid, ...shown.filter((r) => r.id !== tonightId)] : shown;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          label="Show"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
        {schedule && <Button onClick={() => setScheduling(true)}>{SCHEDULE_RAID}</Button>}
      </div>

      {canRespond && !viewer.availabilitySubmitted && (
        <p role="status" className="text-sm text-warn">
          {AVAILABILITY_PROMPT}{' '}
          <a href="/members/availability" className="font-semibold underline decoration-warn/40 underline-offset-2 hover:decoration-warn">
            Paint it now
          </a>
        </p>
      )}

      {ordered.length === 0 ? (
        scope === 'upcoming' ? (
          <EmptyState
            title={CALENDAR_EMPTY.title}
            className="min-h-[260px]"
            action={
              schedule && (
                <Button variant="secondary" onClick={() => setScheduling(true)}>
                  {SCHEDULE_RAID}
                </Button>
              )
            }
          >
            {CALENDAR_EMPTY.body}
          </EmptyState>
        ) : (
          <p className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-2">{CALENDAR_PAST_EMPTY}</p>
        )
      ) : (
        <ol className="flex flex-col gap-3">
          {ordered.map((raid) => (
            <RaidCardRow key={raid.id} raid={raid} tonight={raid.id === tonightId} canRespond={canRespond} past={scope === 'past'} onRespond={(response) => respond(raid.id, response)} />
          ))}
        </ol>
      )}

      {schedule && <ScheduleRaidModal open={scheduling} initial={schedule.initial} onClose={closeSchedule} onScheduled={onScheduled} />}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
