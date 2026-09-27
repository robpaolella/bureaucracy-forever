'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Choice, useToast } from '@/components/ui';
import type { DetailRow } from '@/lib/raid-detail';
import { attendanceCandidates } from '@/lib/raid-detail';
import { SAVE_FAILED } from '@/content/calendar';
import { ANSWER_LABEL, ATTENDANCE } from '@/content/raid';

type Props = {
  raidId: string;
  rows: DetailRow[];
};

/**
 * "Mark attendance" (SYNC-SPEC §9.5), officers, after the raid ends: everyone who accepted
 * or was tentative, ticked when they accepted unless already recorded, saved in one write.
 */
export function AttendanceForm({ raidId, rows }: Props) {
  const router = useRouter();
  const toast = useToast();
  const candidates = attendanceCandidates(rows);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(candidates.map((c) => [c.row.userId, c.checked])));
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const attended = candidates.filter((c) => checked[c.row.userId]).map((c) => c.row.userId);
    const absent = candidates.filter((c) => !checked[c.row.userId]).map((c) => c.row.userId);
    try {
      const res = await fetch(`/api/raids/${raidId}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attended, absent }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({ tone: 'stop', title: body?.error ?? SAVE_FAILED });
        return;
      }
      toast({ tone: 'ok', title: ATTENDANCE.saved(attended.length + absent.length) });
      router.refresh();
    } catch {
      toast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-line bg-ink-850 p-4" aria-labelledby="attendance-heading">
      <h2 id="attendance-heading" className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
        {ATTENDANCE.heading}
      </h2>
      <p className="text-small text-fg-3">{ATTENDANCE.lede}</p>
      {candidates.length === 0 ? (
        <p className="text-sm text-fg-3">{ATTENDANCE.empty}</p>
      ) : (
        <>
          <ul className="grid gap-x-6 sm:grid-cols-2">
            {candidates.map(({ row }) => (
              <li key={row.userId}>
                <Choice
                  type="checkbox"
                  checked={checked[row.userId] ?? false}
                  onChange={(e) => setChecked((c) => ({ ...c, [row.userId]: e.target.checked }))}
                  label={
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold text-fg">{row.name}</span>
                      <span className="text-small text-fg-3">{row.response ? ANSWER_LABEL[row.response] : ''}{row.standing === 'BENCH' ? ` · ${ATTENDANCE.bench}` : ''}</span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
          <div>
            <Button type="submit" variant="secondary" size="sm" loading={saving}>
              {ATTENDANCE.save}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
