'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ClassAvatar, SourceBadge, useToast } from '@/components/ui';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import { raidRowMeta } from '@/lib/roster-level';
import type { DetailRow } from '@/lib/raid-detail';
import { SAVE_FAILED } from '@/content/calendar';
import { ANSWER_LABEL, BENCH, UNKNOWN_MAIN } from '@/content/raid';
import { AnswerFor } from './AnswerFor';
import { useManageSignups } from './ManageSignups';

type Props = {
  raidId: string;
  rows: DetailRow[];
  /** Officers can move a bench member onto the roster or answer for them while the raid is open, once Manage sign-ups is on. */
  officer: boolean;
};

/** The bench (SYNC-SPEC §7, §9.5): members off the roster who answered, with "Move to roster" for officers. */
export function BenchCard({ raidId, rows, officer }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [moving, setMoving] = useState<string | null>(null);
  const { on } = useManageSignups();
  const manage = officer && on;

  async function moveToRoster(row: DetailRow) {
    if (moving) return;
    setMoving(row.userId);
    try {
      const res = await fetch(`/api/raids/${raidId}/signups/${row.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standing: 'ROSTER' }),
        credentials: 'same-origin',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast({ tone: 'stop', title: body?.error ?? SAVE_FAILED });
        return;
      }
      toast({ tone: 'ok', title: BENCH.moved(row.name) });
      router.refresh();
    } catch {
      toast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setMoving(null);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-card border border-line bg-ink-850 p-4" aria-labelledby="bench-heading">
      <h2 id="bench-heading" className="flex items-baseline gap-2 text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
        {BENCH.heading}
        <span className="tabular text-fg-2">{rows.length}</span>
      </h2>
      <p className="text-small text-fg-3">{BENCH.lede}</p>
      {rows.length === 0 ? (
        <p className="pt-1 text-sm text-fg-3">{BENCH.empty}</p>
      ) : (
        <ul className="divide-y divide-line-faint">
          {rows.map((row) => {
            const color = row.wowClass ? CLASS_COLORS[row.wowClass].onInk : undefined;
            const meta = row.wowClass ? raidRowMeta([row.character, CLASS_COLORS[row.wowClass].label, row.spec], row.level) : UNKNOWN_MAIN;
            if (manage) {
              return (
                <li key={row.userId} className="flex flex-col gap-2 py-3">
                  <div className="flex items-start gap-3">
                    <ClassAvatar name={row.name} wowClass={row.wowClass} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color }}>
                        {row.name}
                      </span>
                      <span className="text-small text-fg-3 [overflow-wrap:anywhere]">{meta}</span>
                    </div>
                    <Button variant="secondary" size="sm" className="shrink-0" loading={moving === row.userId} onClick={() => moveToRoster(row)}>
                      {BENCH.moveToRoster}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-9">
                    <AnswerFor raidId={raidId} userId={row.userId} name={row.name} current={row.response} allowAbsent={false} />
                    <SourceBadge source={row.source} />
                  </div>
                </li>
              );
            }
            return (
              <li key={row.userId} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <ClassAvatar name={row.name} wowClass={row.wowClass} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold" style={{ color }}>
                    {row.name}
                  </span>
                  <span className="truncate text-small text-fg-3">{meta}</span>
                </div>
                <span className="text-sm font-semibold text-fg-2">{row.response ? ANSWER_LABEL[row.response] : ''}</span>
                <SourceBadge source={row.source} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
