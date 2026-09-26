'use client';

import { useState } from 'react';
import { SegmentedControl, Toast, type Segment, type ToastData } from '@/components/ui';
import { NEED_LABEL, type NeedStatus } from '@/content/recruitment';
import { rolesOfSpec, type NeedRow } from '@/lib/class-needs';
import { CLASS_COLORS, CLASSES, ROLE_LABELS } from '@/lib/design/class-colors';
import { SAVE_FAILED } from '@/content/calendar';
import { NEEDS_EDITOR } from '@/content/needs-editor';

type Props = { rows: NeedRow[] };

const OPTIONS: readonly Segment<NeedStatus>[] = [
  { value: 'high', label: NEED_LABEL.high, tone: 'ok' },
  { value: 'medium', label: NEED_LABEL.medium, tone: 'warn' },
  { value: 'closed', label: NEED_LABEL.closed, tone: 'neutral' },
];

const key = (r: { wowClass: string; spec: string }) => `${r.wowClass}/${r.spec}`;

/**
 * Every class and spec with a three-way status control. A change saves at once and
 * reverts with a toast if the write fails; there is no save button, the same way the
 * raid response works.
 */
export function NeedsEditor({ rows }: Props) {
  const [status, setStatus] = useState(() => new Map(rows.map((r) => [key(r), r.status])));
  const [toast, setToast] = useState<ToastData | null>(null);

  async function change(row: NeedRow, next: NeedStatus) {
    const previous = status.get(key(row)) ?? row.status;
    if (previous === next) return;
    setStatus((m) => new Map(m).set(key(row), next));
    try {
      const res = await fetch('/api/class-needs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wowClass: row.wowClass, spec: row.spec, status: next }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(String(res.status));
      setToast({ tone: 'ok', title: NEEDS_EDITOR.saved(CLASS_COLORS[row.wowClass].label, row.spec, NEED_LABEL[next]) });
    } catch {
      setStatus((m) => new Map(m).set(key(row), previous));
      setToast({ tone: 'stop', title: SAVE_FAILED });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {CLASSES.map((wowClass) => {
        const mine = rows.filter((r) => r.wowClass === wowClass);
        return (
          <section key={wowClass} className="flex flex-col gap-2" aria-labelledby={`needs-${wowClass}`}>
            <h2 id={`needs-${wowClass}`} className="text-[17px] font-semibold" style={{ color: CLASS_COLORS[wowClass].onInk }}>
              {CLASS_COLORS[wowClass].label}
            </h2>
            <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
              {mine.map((row) => (
                <li key={key(row)} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{row.spec}</span>
                    <span className="text-[13px] text-fg-3">{rolesOfSpec(row.wowClass, row.spec).map((r) => ROLE_LABELS[r]).join(' · ')}</span>
                  </div>
                  <SegmentedControl
                    label={NEEDS_EDITOR.statusFor(CLASS_COLORS[wowClass].label, row.spec)}
                    size="sm"
                    value={status.get(key(row)) ?? row.status}
                    onChange={(next) => change(row, next)}
                    options={OPTIONS}
                    fill
                    className="md:w-[360px] md:shrink-0"
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
