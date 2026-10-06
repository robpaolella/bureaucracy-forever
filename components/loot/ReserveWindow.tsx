'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { Button, Modal, type ToastData } from '@/components/ui';
import { CONTROL } from '@/components/ui/Field';
import { SAVE_FAILED } from '@/content/calendar';
import { RESERVES } from '@/content/reserves';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import type { ReserveTargetRow, ReserveWindowData } from '@/lib/loot-data';
import { draftPickFor, reserveHolders } from '@/lib/loot-rules';
import { promptsReserves, raidDate, type RaidResponse } from '@/lib/raids';
import { ReservePicker } from './ReservePicker';

type WindowRaid = { id: string; name: string; startsAt: string };
/** The sign-up the window follows ("You're in for Wednesday — Onyxia's Lair") and its Undo. */
type Confirm = { text: string; onUndo: () => void };

type Props = {
  open: boolean;
  onClose: () => void;
  raid: WindowRaid;
  data: Pick<ReserveWindowData, 'table' | 'reserves' | 'targets' | 'lockAt'>;
  /** Whose reserves it opens on; the viewer's own by default. */
  targetId?: string;
  confirm?: Confirm;
  notify: (toast: ToastData) => void;
};

type Draft = { userId: string; characterId: string; hr: number | null; sr: number | null };

function draftFor(targets: ReserveTargetRow[], userId?: string): Draft | null {
  const t = targets.find((x) => x.userId === userId) ?? targets.find((x) => x.self) ?? targets[0];
  if (!t) return null;
  const main = t.characters.find((c) => c.isMain) ?? t.characters[0];
  return { userId: t.userId, characterId: t.current.characterId ?? main.id, hr: t.current.hr, sr: t.current.sr };
}

const LABEL = 'text-xs font-semibold uppercase tracking-[0.08em] text-fg-2';
const SELECT = cn(CONTROL, 'h-[46px] w-auto min-w-0 max-w-full px-3');

/**
 * "Pick your reserves": the picker in a window, opened after Accept or Tentative and from the
 * raid page's "Loot reserves" section. Each opening starts from the saved reserves; "Not now"
 * saves nothing, and a failed save keeps the picks with the error above the buttons. Focus
 * starts in the search field and returns to the opener (native dialog).
 */
export function ReserveWindow({ open, onClose, raid, data, targetId, confirm, notify }: Props) {
  const router = useRouter();
  const { table, reserves, targets, lockAt } = data;
  const holders = useMemo(() => reserveHolders(reserves), [reserves]);
  const [draft, setDraft] = useState(() => draftFor(targets, targetId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openings, setOpenings] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  const formId = useId();
  const body = useRef<HTMLFormElement>(null);

  // Every opening starts again from what is saved.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(draftFor(targets, targetId));
      setError(null);
      setOpenings((n) => n + 1);
    }
  }

  useEffect(() => {
    // Modal (a child) has already called showModal, which focused the first control.
    if (open) body.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }, [open, openings]);

  const target = draft && targets.find((t) => t.userId === draft.userId);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !draft || !target) return;
    if (draft.hr !== null && draft.hr === draft.sr) {
      setError(RESERVES.sameItem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/raids/${raid.id}/reserves`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ characterId: draft.characterId, hr: draft.hr, sr: draft.sr, forUserId: target.self ? undefined : target.userId }),
      });
      const result = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(result?.error ?? SAVE_FAILED);
        return;
      }
      notify({ tone: 'ok', title: draft.hr === null && draft.sr === null ? RESERVES.cleared : target.self ? RESERVES.saved : RESERVES.savedFor(target.name) });
      onClose();
      router.refresh();
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function chooseCharacter(characterId: string) {
    if (!draft || !target) return;
    // Neither reserve may select an item this character already won through HR or SR,
    // and a pick on a blocked item is kept only for the character it was saved with.
    const rules = { won: target.blockedHr[characterId] ?? [], blocked: table.blocked, saved: target.current };
    setDraft({ ...draft, characterId, hr: draftPickFor('HR', draft.hr, characterId, rules), sr: draftPickFor('SR', draft.sr, characterId, rules) });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={target && !target.self ? RESERVES.titleFor(target.name) : RESERVES.title}
      eyebrow={confirm && (
        <div role="status" className="flex flex-wrap items-center gap-x-2.5 text-sm font-semibold text-fg">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-ok" />
          {confirm.text}
          <button type="button" onClick={() => { confirm.onUndo(); onClose(); }} className="flex min-h-11 items-center border-b border-teal-dim text-sm font-semibold text-teal transition-[filter] duration-[120ms] hover:brightness-110">
            {RESERVES.undo}
          </button>
        </div>
      )}
      intro={
        <div className="flex flex-col gap-1.5 text-[13px] leading-normal text-fg-2">
          <p>{raid.name} · {raidDate(raid.startsAt)}</p>
          <p>{RESERVES.windowLede} <LocalTime startsAt={lockAt} durationMin={0} className="whitespace-nowrap text-[13px]" />.</p>
        </div>
      }
      actions={<>
        {error && (
          <p role="alert" className="flex basis-full items-start gap-2.5 rounded-control border border-stop-line bg-stop-wash px-3 py-2.5 text-sm font-semibold text-stop">
            <span aria-hidden>!</span>{error}
          </p>
        )}
        <Button variant="ghost" onClick={onClose}>{confirm ? RESERVES.notNow : RESERVES.cancel}</Button>
        <Button type="submit" form={formId} loading={busy}>{RESERVES.save}</Button>
      </>}
    >
      {/* Only while open: the closed window keeps no second copy of the item list in the page. */}
      {open && draft && target && (
        <form ref={body} id={formId} onSubmit={save} className="flex flex-col gap-3.5">
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {targets.length > 1 && (
              <Labelled label={RESERVES.forWhom}>
                <select className={SELECT} value={target.userId} onChange={(e) => { setDraft(draftFor(targets, e.target.value)); setError(null); }}>
                  {targets.map((t) => <option key={t.userId} value={t.userId}>{t.self ? RESERVES.you(t.name) : t.name}</option>)}
                </select>
              </Labelled>
            )}
            <Labelled label={RESERVES.character}>
              <select className={SELECT} value={draft.characterId} onChange={(e) => chooseCharacter(e.target.value)}>
                {target.characters.map((c) => <option key={c.id} value={c.id}>{c.name} · {CLASS_COLORS[c.wowClass].label}</option>)}
              </select>
            </Labelled>
          </div>
          <ReservePicker key={`${openings}-${target.userId}`} table={table} holders={holders}
            mark={{ userId: target.userId, label: target.self ? RESERVES.yours : RESERVES.editing }}
            won={new Set(target.blockedHr[draft.characterId] ?? [])} hr={draft.hr} sr={draft.sr}
            forName={target.self ? null : target.name}
            onChange={(kind, itemId) => setDraft({ ...draft, [kind === 'HR' ? 'hr' : 'sr']: itemId })} />
        </form>
      )}
    </Modal>
  );
}

function Labelled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

/**
 * After a web sign-up, opens the window when `promptsReserves` says so, loading the raid's table
 * and the viewer's reserves first (the calendar has neither). The caller shows its toast at once;
 * `afterAnswer` resolves true when the window opened and took over that line. A newer call,
 * including one with a null answer for an undo, supersedes one still loading.
 */
export function useReservePrompt(notify: (toast: ToastData) => void) {
  const [prompt, setPrompt] = useState<{ raid: WindowRaid; data: ReserveWindowData; confirm: Confirm } | null>(null);
  const [open, setOpen] = useState(false);
  const latest = useRef(0);

  const afterAnswer = useCallback(async (raid: WindowRaid, response: RaidResponse | null, confirm: Confirm) => {
    const call = ++latest.current;
    if (response !== 'accept' && response !== 'tentative') return false;
    const data = await fetch(`/api/raids/${raid.id}/reserves`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<ReserveWindowData>) : null))
      .catch(() => null);
    // A newer answer while this loaded wins.
    if (call !== latest.current || !promptsReserves(response, data)) return false;
    setPrompt({ raid, data: data!, confirm });
    setOpen(true);
    return true;
  }, []);

  const window = prompt && <ReserveWindow open={open} onClose={() => setOpen(false)} raid={prompt.raid} data={prompt.data} confirm={prompt.confirm} notify={notify} />;
  return { afterAnswer, window };
}
