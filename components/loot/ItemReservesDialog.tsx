'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Modal, Tag, Toast, Toggle, useToast, type ToastData } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { LOOT_RESERVES } from '@/content/loot-admin';
import { RESERVES } from '@/content/reserves';
import { cn } from '@/lib/cn';
import type { Holder } from '@/lib/loot-blocks';
import type { ItemView } from '@/lib/loot-items';

export type ReservesTarget = { item: ItemView; blocked: boolean; otherBosses: string[] };

/** The holder confirmation replaces the settings; `stale` when the server's list differed from the one shown. */
type Step = { kind: 'settings' } | { kind: 'confirm'; holders: Holder[]; stale: boolean };
type Change = { blocked: boolean; remove: string[] };

const SETTINGS: Step = { kind: 'settings' };

/**
 * The "Reserves" window for one item (design #131): its reserve settings for the whole tier,
 * and the confirmation naming whose reserves a block removes. The native dialog sits in the
 * top layer, so it carries its own toast to show above itself.
 */
export function ItemReservesDialog({ templateId, target, onClose }: { templateId: string; target: ReservesTarget | null; onClose: () => void }) {
  const router = useRouter();
  const [current, setCurrent] = useState(target);
  const [blocked, setBlocked] = useState(target?.blocked ?? false);
  const [step, setStep] = useState<Step>(SETTINGS);
  // Holders when the window opened (null until read), so a direct block that finds some can say the list changed.
  const [known, setKnown] = useState<Holder[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  // Another item (or none): start over. An answer for the old one reports on the page instead.
  if (target !== current) {
    setCurrent(target);
    setBlocked(target?.blocked ?? false);
    setStep(SETTINGS);
    setKnown(null);
    setBusy(false);
    setToast(null);
  }
  const shown = useRef(target);
  shown.current = target;
  // Retry's closure outlives renders, so the in-flight guard is a ref.
  const saving = useRef(false);
  const pageToast = useToast();
  const body = useRef<HTMLDivElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const focusTo = useRef<'switch' | 'cancel' | 'confirm' | null>(null);

  useEffect(() => {
    if (!target) return;
    let live = true;
    fetch(`/api/loot/tables/${templateId}/items/${target.item.id}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { holders?: Holder[] } | null) => {
        if (live && json?.holders) setKnown(json.holders);
      }, () => {});
    return () => {
      live = false;
    };
  }, [templateId, target]);

  // Changing step swaps the controls out from under focus, so place it after the render.
  useEffect(() => {
    const to = focusTo.current;
    focusTo.current = null;
    if (to === 'switch') body.current?.querySelector<HTMLElement>('[role="switch"]')?.focus();
    else if (to) actions.current?.querySelector<HTMLElement>(`[data-act="${to}"]`)?.focus();
  });

  const back = useCallback(() => {
    focusTo.current = 'switch';
    setStep(SETTINGS);
  }, []);

  // Escape closes the innermost step: the confirmation goes back to the settings, not out of the window.
  useEffect(() => {
    if (step.kind !== 'confirm') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      back();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step.kind, back]);

  if (!target) return <Modal open={false} onClose={onClose} title="">{null}</Modal>;
  const { item, otherBosses } = target;

  async function save(change: Change, stale: boolean) {
    if (saving.current) return;
    const mine = shown.current;
    saving.current = true;
    setBusy(true);
    setToast(null);
    const res = await fetch(`/api/loot/tables/${templateId}/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change),
      credentials: 'same-origin',
    }).catch(() => null);
    const json = ((await res?.json().catch(() => null)) ?? {}) as { removed?: number; holders?: Holder[] };
    saving.current = false;
    const here = shown.current === mine;
    if (here) setBusy(false);
    const show = (next: ToastData) => (here ? setToast(next) : pageToast(next));

    if (res?.status === 409 && json.holders) {
      // Someone reserved (or changed a reserve) since the list was read: show the new one.
      if (!here) return pageToast({ tone: 'stop', title: SAVE_FAILED });
      setKnown(json.holders);
      focusTo.current = 'cancel';
      setStep({ kind: 'confirm', holders: json.holders, stale });
      return;
    }
    if (!res?.ok) {
      // The setting and the confirmation stay as they were; Retry sends the same change again.
      // Its button goes with the toast, so focus moves back to the step's control first.
      const retry = () => {
        const control = change.remove.length ? actions.current?.querySelector<HTMLElement>('[data-act="confirm"]') : body.current?.querySelector<HTMLElement>('[role="switch"]');
        control?.focus();
        void save(change, stale);
      };
      show({ tone: 'stop', title: SAVE_FAILED, action: here ? { label: LOOT_RESERVES.retry, onClick: retry } : undefined });
      return;
    }
    const removed = json.removed ?? 0;
    show({ tone: 'ok', title: !change.blocked ? LOOT_RESERVES.unblocked(item.name) : removed ? LOOT_RESERVES.blockedRemoved(item.name, removed) : LOOT_RESERVES.blocked(item.name) });
    if (here) {
      setBlocked(change.blocked);
      if (change.blocked) setKnown([]);
      focusTo.current = 'switch';
      setStep(SETTINGS);
    }
    router.refresh();
  }

  function onSwitch(open: boolean) {
    if (open) return void save({ blocked: false, remove: [] }, false);
    if (known?.length) {
      focusTo.current = 'cancel';
      setStep({ kind: 'confirm', holders: known, stale: false });
      return;
    }
    // Nobody held it when the window opened (or the list hasn't arrived): block directly.
    void save({ blocked: true, remove: [] }, known !== null);
  }

  const confirming = step.kind === 'confirm' ? step : null;
  return (
    <Modal
      open
      onClose={onClose}
      title={confirming ? LOOT_RESERVES.confirmTitle(item.name) : LOOT_RESERVES.title(item.name)}
      actions={
        <div ref={actions} className="flex gap-2.5 max-[479px]:w-full max-[479px]:flex-col-reverse">
          {confirming ? (
            <>
              <Button variant="ghost" data-act="cancel" onClick={back}>
                {LOOT_RESERVES.cancel}
              </Button>
              <Button variant="danger" data-act="confirm" loading={busy} onClick={() => void save({ blocked: true, remove: confirming.holders.map((h) => h.key) }, true)}>
                {LOOT_RESERVES.confirm(confirming.holders.length)}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              {LOOT_RESERVES.done}
            </Button>
          )}
        </div>
      }
    >
      <div ref={body} aria-busy={busy}>
        {confirming ? (
          <Confirmation holders={confirming.holders} stale={confirming.stale} />
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            {/* Dimmed rather than disabled while saving: disabling the focused switch would drop focus out of the window. */}
            <Toggle label={<span className="font-semibold text-fg">{LOOT_RESERVES.open}</span>} checked={!blocked} onChange={(open) => !saving.current && onSwitch(open)} className={busy ? 'cursor-progress opacity-50' : undefined} />
            {otherBosses.length > 0 && <p className="rounded-card border border-teal-line bg-teal-wash px-3 py-2.5 text-[13px] text-fg-2">{LOOT_RESERVES.shared(otherBosses)}</p>}
          </div>
        )}
        <Toast toast={toast} onDismiss={dismiss} />
      </div>
    </Modal>
  );
}

/** Holders grouped by raid, in start order, each with their character and HR/SR. */
function Confirmation({ holders, stale }: { holders: Holder[]; stale: boolean }) {
  const raids: { raid: Holder['raid']; holders: Holder[] }[] = [];
  for (const h of holders) {
    const group = raids.find((r) => r.raid.id === h.raid.id);
    if (group) group.holders.push(h);
    else raids.push({ raid: h.raid, holders: [h] });
  }
  return (
    <div className="pb-1">
      {stale && (
        <p role="alert" className="mb-3 mt-1 rounded-card border border-warn-line bg-warn-wash px-3 py-2.5 text-[13px] font-semibold text-warn">
          {LOOT_RESERVES.stale}
        </p>
      )}
      <p className="mt-1">{LOOT_RESERVES.confirmLead}</p>
      {raids.map(({ raid, holders: list }) => (
        <section key={raid.id} className="mt-3">
          <h3 className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] font-semibold text-fg">
            {raid.name} <span className="font-normal text-fg-3">{LOOT_RESERVES.raidWhen(new Date(raid.startsAt))}</span>
            {raid.cancelled && <Tag className="py-[1px]">{LOOT_RESERVES.cancelled}</Tag>}
          </h3>
          <ul>
            {list.map((h) => (
              <li key={h.key} className="flex min-h-9 items-center justify-between gap-3 border-t border-line-faint text-fg">
                <span>{h.character}</span>
                <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', h.kind === 'HR' ? 'border-sand-dim bg-sand-wash text-sand' : 'border-teal-line bg-teal-wash text-teal')}>
                  <span aria-hidden>{h.kind}</span>
                  <span className="sr-only">{h.kind === 'HR' ? RESERVES.hr : RESERVES.sr}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="mb-1 mt-3.5">{LOOT_RESERVES.confirmFoot}</p>
    </div>
  );
}
