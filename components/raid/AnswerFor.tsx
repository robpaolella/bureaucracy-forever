'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CONTROL, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { RESPONSES, type RaidResponse } from '@/lib/raids';
import { SAVE_FAILED } from '@/content/calendar';
import { ANSWER_LABEL, onBehalfToast, ROSTER } from '@/content/raid';

type Props = {
  raidId: string;
  userId: string;
  name: string;
  current: RaidResponse | null;
};

/**
 * "Answer for them" on a roster or bench row (SYNC-SPEC §9.5): one compact select that
 * writes through the same route as the member's own answer, recorded as set by the
 * officer. Officers are the one writer the lock does not stop.
 */
export function AnswerFor({ raidId, userId, name, current }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function change(value: string) {
    if (saving) return;
    const response = (value || null) as RaidResponse | null;
    if (response === current) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/raids/${raidId}/signup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, forUserId: userId }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({ tone: 'stop', title: body?.error ?? SAVE_FAILED });
        return;
      }
      toast({ tone: 'ok', title: onBehalfToast(name, response ? ANSWER_LABEL[response].toLowerCase() : null) });
      router.refresh();
    } catch {
      toast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      aria-label={`${ROSTER.answerFor}: ${name}`}
      value={current ?? ''}
      disabled={saving}
      onChange={(e) => change(e.target.value)}
      className={cn(CONTROL, 'h-9 w-[132px] px-2 text-sm')}
    >
      <option value="">{ROSTER.noAnswer}</option>
      {RESPONSES.map((r) => (
        <option key={r} value={r}>
          {ANSWER_LABEL[r]}
        </option>
      ))}
    </select>
  );
}
