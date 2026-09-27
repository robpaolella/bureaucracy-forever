'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, useToast } from '@/components/ui';
import type { DetailRow } from '@/lib/raid-detail';
import { SAVE_FAILED } from '@/content/calendar';
import { UNANSWERED } from '@/content/raid';

type Props = {
  raidId: string;
  rows: DetailRow[];
  /** Officers get "Nudge in Discord" while the raid is open and posted. */
  officer: boolean;
  posted: boolean;
  open: boolean;
};

/** "Hasn't answered" (SYNC-SPEC §9.5): the roster rows still waiting, and the nudge that mentions them in the raid thread. */
export function UnansweredCard({ raidId, rows, officer, posted, open }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function nudge() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/raids/${raidId}/remind`, { method: 'POST', credentials: 'same-origin' });
      const body = (await res.json().catch(() => null)) as { nudged?: number; error?: string } | null;
      if (!res.ok) {
        toast({ tone: 'stop', title: body?.error ?? SAVE_FAILED });
        return;
      }
      toast({ tone: 'ok', title: UNANSWERED.nudged(body?.nudged ?? rows.length) });
      router.refresh();
    } catch {
      toast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-card border border-line bg-ink-850 p-4" aria-labelledby="unanswered-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="unanswered-heading" className="flex items-baseline gap-2 text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
          {UNANSWERED.heading}
          <span className="tabular text-fg-2">{rows.length}</span>
        </h2>
        {officer && open && rows.length > 0 && (
          <Button variant="secondary" size="sm" loading={busy} disabled={!posted} title={posted ? UNANSWERED.nudgeHint : UNANSWERED.noThread} onClick={nudge}>
            {UNANSWERED.nudge}
          </Button>
        )}
      </div>
      {rows.length === 0 ? <p className="text-sm text-fg-3">{UNANSWERED.empty}</p> : <p className="text-sm leading-relaxed text-fg-2">{rows.map((r) => r.name).join(', ')}</p>}
    </section>
  );
}
