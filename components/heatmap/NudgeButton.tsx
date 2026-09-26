'use client';

import { useState } from 'react';
import { Button, Toast, type ToastData } from '@/components/ui';
import { NUDGE_FAILED, NUDGE_LABEL, NUDGE_NONE, NUDGE_SENT, NUDGE_UNCONFIGURED } from '@/content/availability';

/** docs/05 § Hasn't submitted: one button that asks the bot to remind everyone who has not painted. */
export function NudgeButton() {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  async function nudge() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/availability/nudge', { method: 'POST', credentials: 'same-origin' });
      if (res.status === 503) setToast({ tone: 'stop', title: NUDGE_UNCONFIGURED });
      else if (!res.ok) setToast({ tone: 'stop', title: NUDGE_FAILED });
      else {
        const { nudged } = (await res.json()) as { nudged: number };
        setToast(nudged === 0 ? { tone: 'ok', title: NUDGE_NONE } : { tone: 'ok', title: NUDGE_SENT(nudged) });
      }
    } catch {
      setToast({ tone: 'stop', title: NUDGE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" loading={busy} onClick={nudge}>
        {NUDGE_LABEL}
      </Button>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
