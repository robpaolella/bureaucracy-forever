'use client';

import { useRef, useState } from 'react';
import { Button, SegmentedControl, StarIcon, Toast, type Segment, type ToastData } from '@/components/ui';
import { NEED_LABEL, type NeedStatus } from '@/content/recruitment';
import { needSpec, type NeedRow } from '@/lib/class-needs';
import { cn } from '@/lib/cn';
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
 * raid response works. A star beside a high-need spec features it first on the home
 * page; there is one star at a time.
 */
export function NeedsEditor({ rows }: Props) {
  const [status, setStatus] = useState(() => new Map(rows.map((r) => [key(r), r.status])));
  const [featured, setFeatured] = useState<string | null>(() => {
    const row = rows.find((r) => r.featured);
    return row ? key(row) : null;
  });
  /** Star writes in click order share one generation: only the latest may revert. */
  const featureGeneration = useRef(0);
  const [toast, setToast] = useState<ToastData | null>(null);
  /** Per-row request generation: a superseded write neither confirms nor reverts anything. */
  const generation = useRef(new Map<string, number>());

  async function change(row: NeedRow, next: NeedStatus) {
    const previous = status.get(key(row)) ?? row.status;
    if (previous === next) return;
    const seq = (generation.current.get(key(row)) ?? 0) + 1;
    generation.current.set(key(row), seq);
    setStatus((m) => new Map(m).set(key(row), next));
    // The server drops the star from a spec that leaves high need; mirror it.
    const lostStar = next !== 'high' && featured === key(row);
    if (lostStar) setFeatured(null);
    try {
      const res = await fetch('/api/class-needs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wowClass: row.wowClass, spec: row.spec, status: next }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(String(res.status));
      if (generation.current.get(key(row)) !== seq) return;
      setToast({ tone: 'ok', title: NEEDS_EDITOR.saved(CLASS_COLORS[row.wowClass].label, row.spec, NEED_LABEL[next]) });
    } catch {
      if (generation.current.get(key(row)) !== seq) return;
      setStatus((m) => new Map(m).set(key(row), previous));
      if (lostStar) setFeatured((f) => f ?? key(row));
      setToast({ tone: 'stop', title: SAVE_FAILED });
    }
  }

  async function toggleFeatured(row: NeedRow) {
    const previous = featured;
    const on = previous !== key(row);
    const seq = ++featureGeneration.current;
    setFeatured(on ? key(row) : null);
    const who = `${CLASS_COLORS[row.wowClass].label} ${row.spec}`;
    try {
      const res = await fetch('/api/class-needs/featured', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wowClass: row.wowClass, spec: row.spec, featured: on }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(String(res.status));
      if (featureGeneration.current !== seq) return;
      setToast({ tone: 'ok', title: on ? NEEDS_EDITOR.featured(who) : NEEDS_EDITOR.unfeatured(who) });
    } catch {
      if (featureGeneration.current !== seq) return;
      setFeatured(previous);
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
                <li key={key(row)} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 md:flex md:gap-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{needSpec(row.wowClass, row.spec)?.spec ?? row.spec}</span>
                    <span className="text-[13px] text-fg-3">{needSpec(row.wowClass, row.spec)?.roles.map((r) => ROLE_LABELS[r]).join(' · ')}</span>
                  </div>
                  <FeatureToggle
                    who={`${CLASS_COLORS[wowClass].label} ${row.spec}`}
                    on={featured === key(row)}
                    high={(status.get(key(row)) ?? row.status) === 'high'}
                    onToggle={() => toggleFeatured(row)}
                  />
                  <SegmentedControl
                    label={NEEDS_EDITOR.statusFor(CLASS_COLORS[wowClass].label, row.spec)}
                    size="sm"
                    value={status.get(key(row)) ?? row.status}
                    onChange={(next) => change(row, next)}
                    options={OPTIONS}
                    fill
                    className="col-span-2 md:w-[360px] md:shrink-0"
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

/**
 * The home-page star. A real toggle button (aria-pressed), 44px. Off a high-need spec it
 * stays visible but disabled, so officers can see where stars go.
 */
function FeatureToggle({ who, on, high, onToggle }: { who: string; on: boolean; high: boolean; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      iconOnly
      aria-pressed={on}
      aria-label={NEEDS_EDITOR.featureLabel(who)}
      title={high ? NEEDS_EDITOR.featureLabel(who) : NEEDS_EDITOR.featureOnlyHigh}
      disabled={!high}
      onClick={onToggle}
      className={cn('shrink-0', !high && 'bg-transparent opacity-40', on ? 'text-sand' : 'text-fg-3')}
    >
      <StarIcon filled={on} />
    </Button>
  );
}
