'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { Button, Modal, Toast, Toggle, type ToastData } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { LOOT_RESERVES } from '@/content/loot-admin';
import type { ItemView } from '@/lib/loot-items';

export type ReservesTarget = { item: ItemView; blocked: boolean; otherBosses: string[] };

/**
 * The "Reserves" window for one item (design #131): its reserve settings for the whole tier.
 * The native dialog sits in the top layer, so it carries its own toast to show above itself.
 */
export function ItemReservesDialog({ templateId, target, onClose }: { templateId: string; target: ReservesTarget | null; onClose: () => void }) {
  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={target ? LOOT_RESERVES.title(target.item.name) : ''}
      actions={
        <Button variant="secondary" onClick={onClose} className="max-[479px]:w-full">
          {LOOT_RESERVES.done}
        </Button>
      }
    >
      {target && <Settings key={target.item.id} templateId={templateId} target={target} />}
    </Modal>
  );
}

// One step of the window. #135 swaps in a holder confirmation from here; #122 adds the win limit below the switch.
function Settings({ templateId, target }: { templateId: string; target: ReservesTarget }) {
  const router = useRouter();
  const { item, otherBosses } = target;
  const [blocked, setBlocked] = useState(target.blocked);
  const [busy, setBusy] = useState(false);
  // Retry's closure outlives renders, so the in-flight guard is a ref.
  const saving = useRef(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const switchRow = useRef<HTMLDivElement>(null);

  async function save(next: boolean) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setToast(null);
    const ok = await fetch(`/api/loot/tables/${templateId}/items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: next }),
      credentials: 'same-origin',
    }).then((res) => res.ok, () => false);
    saving.current = false;
    setBusy(false);
    if (!ok) {
      // The switch keeps its saved value; Retry sends the same change again. Its button goes
      // with the toast, so focus moves back to the switch first.
      const retry = () => {
        switchRow.current?.querySelector<HTMLElement>('[role="switch"]')?.focus();
        void save(next);
      };
      setToast({ tone: 'stop', title: SAVE_FAILED, action: { label: LOOT_RESERVES.retry, onClick: retry } });
      return;
    }
    setBlocked(next);
    setToast({ tone: 'ok', title: next ? LOOT_RESERVES.blocked(item.name) : LOOT_RESERVES.unblocked(item.name) });
    router.refresh();
  }

  return (
    <div ref={switchRow} className="flex flex-col gap-3 pb-2" aria-busy={busy}>
      {/* Dimmed rather than disabled while saving: disabling the focused switch would drop focus out of the window. */}
      <Toggle label={<span className="font-semibold text-fg">{LOOT_RESERVES.open}</span>} checked={!blocked} onChange={(open) => void save(!open)} className={busy ? 'cursor-progress opacity-50' : undefined} />
      {otherBosses.length > 0 && <p className="rounded-card border border-teal-line bg-teal-wash px-3 py-2.5 text-[13px] text-fg-2">{LOOT_RESERVES.shared(otherBosses)}</p>}
      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
