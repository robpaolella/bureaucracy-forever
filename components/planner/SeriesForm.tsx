'use client';

import { useState, type FormEvent } from 'react';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { GUILD_TIMEZONE } from '@/lib/config';
import { parseSeriesInput, WEEKDAY_LABELS, type SeriesInput } from '@/lib/raid-series-rules';
import { formatClock, nextOccurrence, type Weekday } from '@/lib/time';
import { SERIES } from '@/content/planner';

type TemplateOption = { id: string; name: string; durationMin: number };
type Props = { templates: TemplateOption[]; initial: SeriesInput; submitLabel: string; hint?: string; onSubmit: (input: SeriesInput) => Promise<string | null>; onCancel?: () => void };

const LENGTHS = [60, 90, 120, 150, 180, 210, 240, 270, 300];

export function SeriesForm({ templates, initial, submitLabel, hint, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const viewer = useViewerTimeZone();
  const set = <K extends keyof SeriesInput>(k: K, v: SeriesInput[K]) => {
    setInput((s) => ({ ...s, [k]: v }));
    setError(null);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseSeriesInput(input);
    if (!parsed.ok) return setError(parsed.error);
    setSaving(true);
    const message = await onSubmit(parsed.value);
    setSaving(false);
    if (message) setError(message);
  }
  const preview = /^\d{2}:\d{2}$/.test(input.startTime) ? nextOccurrence(input.weekday as Weekday, input.startTime, GUILD_TIMEZONE) : null;
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Select label={SERIES.template} options={templates.map((t) => ({ value: t.id, label: t.name }))} value={input.templateId} onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); set('templateId', e.target.value); if (t) set('durationMin', t.durationMin); }} />
      <div className="grid grid-cols-2 gap-3">
        <Select label={SERIES.weekday} options={WEEKDAY_LABELS.map((w, i) => ({ value: String(i), label: w }))} value={String(input.weekday)} onChange={(e) => set('weekday', Number(e.target.value))} />
        <Field label={SERIES.start} hint={preview && viewer ? `${formatClock(preview, GUILD_TIMEZONE)} guild · ${formatClock(preview, viewer.zone)} yours` : undefined}>
          <Input type="time" step={900} value={input.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label={SERIES.length} options={LENGTHS.map((m) => ({ value: String(m), label: m % 60 ? `${Math.floor(m / 60)}½ hours` : `${m / 60} hours` }))} value={String(input.durationMin)} onChange={(e) => set('durationMin', Number(e.target.value))} />
        <Field label={SERIES.postAhead}>
          <Input type="number" inputMode="numeric" min={1} max={60} value={input.postAheadDays} onChange={(e) => set('postAheadDays', Number(e.target.value))} />
        </Field>
        <Field label={SERIES.lock}>
          <Input type="number" inputMode="numeric" min={0} max={1440} step={15} value={input.lockMinutesBefore} onChange={(e) => set('lockMinutesBefore', Number(e.target.value))} />
        </Field>
        <Field label={SERIES.horizon}>
          <Input type="number" inputMode="numeric" min={1} max={12} value={input.horizonWeeks} onChange={(e) => set('horizonWeeks', Number(e.target.value))} />
        </Field>
      </div>
      <Field label={SERIES.notes} hint={SERIES.notesHint}>
        <Textarea rows={2} maxLength={500} value={input.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      {hint && <p className="text-xs text-fg-3">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-stop">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2.5 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {SERIES.cancel}
          </Button>
        )}
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
