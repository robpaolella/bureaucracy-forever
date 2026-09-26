'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSignup } from '@/components/calendar/useSignup';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { SegmentedControl, Toast, type ToastData } from '@/components/ui';
import type { Role } from '@/lib/design/class-colors';
import { responseToast, type RaidCard, type RaidResponse } from '@/lib/raids';
import { SAVE_FAILED } from '@/content/calendar';

const RESPONSE_OPTIONS = [
  { value: 'accept', label: 'Accept', tone: 'ok' },
  { value: 'tentative', label: 'Tentative', tone: 'warn' },
  { value: 'absent', label: 'Absent', tone: 'stop' },
] as const;

type Props = {
  raid: RaidCard;
  viewer: { role: 'social' | 'member' | 'officer'; raidRole: Role | null };
  past: boolean;
};

/**
 * The viewer's own Accept / Tentative / Absent on the detail head (docs/04 § Raid detail):
 * the same control as the list row, written optimistically through `useSignup`, with the
 * toast and Undo. After the server confirms, the page refreshes so the summary card and
 * the sign-up sections pick the answer up.
 */
export function RaidResponseControl({ raid: initial, viewer, past }: Props) {
  const router = useRouter();
  const zone = useViewerTimeZone();
  const [toast, setToast] = useState<ToastData | null>(null);

  const onResult = useCallback(
    (ok: boolean, raid: RaidCard, response: RaidResponse | null, undo: () => void) => {
      if (!ok) {
        setToast({ tone: 'stop', title: SAVE_FAILED });
        return;
      }
      const copy = responseToast(raid, response, zone?.zone ?? null);
      setToast({ tone: 'ok', title: copy.title, detail: copy.detail, action: { label: 'Undo', onClick: undo } });
      router.refresh();
    },
    [zone, router],
  );
  const { raids, respond } = useSignup([initial], viewer.raidRole, onResult);
  const raid = raids[0];

  if (viewer.role === 'social') return null;
  const closed = past || raid.cancelled;
  return (
    <>
      {closed ? (
        raid.mine && (
          <p className="text-sm text-fg-3">
            You answered <span className="font-semibold text-fg-2">{RESPONSE_OPTIONS.find((o) => o.value === raid.mine)?.label}</span>
          </p>
        )
      ) : (
        <SegmentedControl label={`Your response to ${raid.name}`} value={raid.mine} onChange={(r) => respond(raid.id, r)} options={RESPONSE_OPTIONS} fill className="md:w-auto md:[&>button]:flex-none" />
      )}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
