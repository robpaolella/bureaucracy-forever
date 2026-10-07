'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useSignup } from '@/components/calendar/useSignup';
import { useReservePrompt } from '@/components/loot/ReserveWindow';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { CONTROL, FIELD_LABEL, SegmentedControl, Toast, type ToastData } from '@/components/ui';
import { CLASS_COLORS, type Role, type WowClass } from '@/lib/design/class-colors';
import { responseToast, type RaidCard, type RaidResponse } from '@/lib/raids';
import { signupsClosed } from '@/lib/raid-detail';
import { SAVE_FAILED } from '@/content/calendar';
import { RESPONSE_NOTES } from '@/content/raid';
import { RESERVES } from '@/content/reserves';

const RESPONSE_OPTIONS = [
  { value: 'accept', label: 'Accept', tone: 'ok' },
  { value: 'tentative', label: 'Tentative', tone: 'warn' },
  { value: 'absent', label: 'Absent', tone: 'stop' },
] as const;

type CharacterOption = { id: string; name: string; wowClass: WowClass; role: Role };

type Props = {
  raid: RaidCard;
  viewer: { role: 'social' | 'member' | 'officer'; raidRole: Role | null };
  characters: CharacterOption[];
  /** The server's current character choice, or null without a sign-up. */
  broughtId: string | null;
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
export function RaidResponseControl({ raid: initial, viewer, characters, broughtId, past, now }: Props) {
  const router = useRouter();
  const zone = useViewerTimeZone();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [selectedId, setSelectedId] = useState(broughtId ?? '');
  const [selectedBroughtId, setSelectedBroughtId] = useState(broughtId);
  const [lockedBySwitch, setLockedBySwitch] = useState(false);
  // A router refresh supplies the saved choice as a new prop. Reset during render so the
  // browser never paints a stale local choice, while a pending local switch remains intact.
  if (broughtId !== selectedBroughtId) {
    setSelectedBroughtId(broughtId);
    setSelectedId(broughtId ?? '');
  }

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
      void afterAnswer(raid, undone ? null : response, { text: copy.title, onUndo: undo }).then((opened) => { if (opened) setToast((shown) => (shown === toast ? null : shown)); });
      router.refresh();
    },
    [zone, router, afterAnswer],
  );
  const { raids, respond, switchCharacter, pending } = useSignup([initial], viewer.raidRole, onResult);
  const raid = raids[0];

  if (viewer.role === 'social') return null;
  const closed = lockedBySwitch || signupsClosed(raid, past, new Date(now));
  const offRoster = raid.onRoster === false;
  const options = offRoster ? RESPONSE_OPTIONS.filter((o) => o.value !== 'absent') : RESPONSE_OPTIONS;
  const canChooseCharacter = characters.length > 1 && (raid.mine === 'accept' || raid.mine === 'tentative');
  const brought = characters.find((character) => character.id === selectedId) ?? characters.find((character) => character.id === broughtId);

  async function chooseCharacter(characterId: string) {
    if (!brought || characterId === brought.id) return;
    const character = characters.find((candidate) => candidate.id === characterId);
    if (!character) return;
    const previousId = selectedId;
    setSelectedId(characterId);
    const result = await switchCharacter(raid.id, character.id, character.role);
    if (result.ok) {
      if (result.removed.length) {
        setToast({
          tone: 'ok',
          title: RESPONSE_NOTES.characterChanged,
          detail: result.removed.map((reserve) => RESERVES.removed(reserve.kind, reserve.itemName, reserve.reason)).join(' '),
        });
      }
      router.refresh();
      return;
    }
    setSelectedId(previousId);
    if (result.status === 409 && /^Sign-ups are locked\./.test(result.error)) setLockedBySwitch(true);
    setToast({ tone: 'stop', title: result.error });
  }

  return (
    <div className="flex flex-col gap-2 md:items-end">
      {closed ? (
        <div className="flex flex-col gap-1 text-sm text-fg-3 md:items-end">
          {raid.mine ? (
            <p>
              {RESPONSE_NOTES.youAnswered} <span className="font-semibold text-fg-2">{RESPONSE_OPTIONS.find((o) => o.value === raid.mine)?.label}</span>
            </p>
          ) : (
            !past && !raid.cancelled && <p>{RESPONSE_NOTES.locked}</p>
          )}
          {canChooseCharacter && brought && <p>{RESPONSE_NOTES.bringing} <span className="font-semibold text-fg-2">{brought.name}</span></p>}
        </div>
      ) : (
        <>
          <SegmentedControl label={`Your response to ${raid.name}`} value={raid.mine} onChange={(r) => respond(raid.id, r)} options={options} fill disabled={pending.has(raid.id)} className="md:w-auto md:[&>button]:flex-none" />
          {canChooseCharacter && brought && (
            <div className="flex w-full flex-col gap-2 md:w-[220px]">
              <label htmlFor={`bringing-${raid.id}`} className={FIELD_LABEL}>{RESPONSE_NOTES.bringing}</label>
              <select
                id={`bringing-${raid.id}`}
                className={`${CONTROL} h-[46px] px-3`}
                value={selectedId}
                disabled={pending.has(raid.id)}
                onChange={(event) => void chooseCharacter(event.target.value)}
              >
                {characters.map((character) => <option key={character.id} value={character.id}>{character.name} · {CLASS_COLORS[character.wowClass].label}</option>)}
              </select>
            </div>
          )}
          {offRoster && <p className="text-small text-fg-3">{RESPONSE_NOTES.offRoster}</p>}
        </>
      )}
      {reserveWindow}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
