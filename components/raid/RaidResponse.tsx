'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSignup } from '@/components/calendar/useSignup';
import { useReservePrompt } from '@/components/loot/ReserveWindow';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { SegmentedControl, Toast, type ToastData } from '@/components/ui';
import type { Role } from '@/lib/design/class-colors';
import { responseToast, type RaidCard, type RaidResponse } from '@/lib/raids';
import { signupsClosed } from '@/lib/raid-detail';
import { SAVE_FAILED } from '@/content/calendar';
import { RESPONSE_NOTES } from '@/content/raid';

const RESPONSE_OPTIONS = [
  { value: 'accept', label: 'Accept', tone: 'ok' },
  { value: 'tentative', label: 'Tentative', tone: 'warn' },
  { value: 'absent', label: 'Absent', tone: 'stop' },
] as const;

type Props = {
  raid: RaidCard;
  viewer: { role: 'social' | 'member' | 'officer'; raidRole: Role | null };
  past: boolean;
  /** ISO instant the page rendered at, for the lock check. */
  now: string;
};

/**
 * The viewer's own Accept / Tentative / Absent on the detail head (docs/04 § Raid detail):
 * the same control as the list row, written optimistically through `useSignup`, with the
 * toast and Undo. After the server confirms, the page refreshes so the summary card and
 * the sign-up sections pick the answer up. Locked, finished and cancelled raids show the
 * answer as text (SYNC-SPEC §7); a member off the roster sees that accepting benches them
 * and cannot decline, since a decline off the roster means nothing.
 */
export function RaidResponseControl({ raid: initial, viewer, past, now }: Props) {
  const router = useRouter();
  const zone = useViewerTimeZone();
  const [toast, setToast] = useState<ToastData | null>(null);

  const { afterAnswer, window: reserveWindow } = useReservePrompt(setToast);
  const onResult = useCallback(
    (ok: boolean, raid: RaidCard, response: RaidResponse | null, undo: () => void, undone: boolean) => {
      if (!ok) {
        setToast({ tone: 'stop', title: SAVE_FAILED });
        return;
      }
      const copy = responseToast(raid, response, zone?.zone ?? null);
      const toast: ToastData = { tone: 'ok', title: copy.title, detail: copy.detail, action: { label: 'Undo', onClick: undo } };
      setToast(toast);
      // Accept or Tentative may then open the reserves window, which takes over the line and Undo.
      // An undo never prompts, and it stops a prompt still loading for the answer it reverted.
      void afterAnswer(raid, undone ? null : response, { text: copy.title, onUndo: undo }).then((opened) => { if (opened) setToast(null); });
      router.refresh();
    },
    [zone, router, afterAnswer],
  );
  const { raids, respond } = useSignup([initial], viewer.raidRole, onResult);
  const raid = raids[0];

  if (viewer.role === 'social') return null;
  const closed = signupsClosed(raid, past, new Date(now));
  const offRoster = raid.onRoster === false;
  const options = offRoster ? RESPONSE_OPTIONS.filter((o) => o.value !== 'absent') : RESPONSE_OPTIONS;
  return (
    <div className="flex flex-col gap-2 md:items-end">
      {closed ? (
        <p className="text-sm text-fg-3">
          {raid.mine ? (
            <>
              {RESPONSE_NOTES.youAnswered} <span className="font-semibold text-fg-2">{RESPONSE_OPTIONS.find((o) => o.value === raid.mine)?.label}</span>
            </>
          ) : (
            !past && !raid.cancelled && RESPONSE_NOTES.locked
          )}
        </p>
      ) : (
        <>
          <SegmentedControl label={`Your response to ${raid.name}`} value={raid.mine} onChange={(r) => respond(raid.id, r)} options={options} fill className="md:w-auto md:[&>button]:flex-none" />
          {offRoster && <p className="text-small text-fg-3">{RESPONSE_NOTES.offRoster}</p>}
        </>
      )}
      {reserveWindow}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
