'use client';

import { useState, type FormEvent } from 'react';
import { Button, CONTROL, Field, FIELD_LABEL, Input } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ROLE_LABELS, ROLES } from '@/lib/design/class-colors';
import { parseTemplateInput, type TemplateInput } from '@/lib/raid-series-rules';
import { TEMPLATES } from '@/content/planner';

type Props = { initial: TemplateInput; onSubmit: (input: TemplateInput) => Promise<string | null>; onCancel: () => void };

export function TemplateForm({ initial, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => {
    setInput((s) => ({ ...s, [k]: v }));
    setError(null);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseTemplateInput(input);
    if (!parsed.ok) return setError(parsed.error);
    setSaving(true);
    const message = await onSubmit(parsed.value);
    setSaving(false);
    if (message) setError(message);
  }
  const sum = ROLES.reduce((n, r) => n + input.requirements[r], 0);
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field label={TEMPLATES.name}>
          <Input value={input.name} maxLength={60} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label={TEMPLATES.short}>
          <Input value={input.short} maxLength={8} onChange={(e) => set('short', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={TEMPLATES.size}>
          <Input type="number" inputMode="numeric" min={5} max={40} value={input.size} onChange={(e) => set('size', Number(e.target.value))} />
        </Field>
        <Field label={`${TEMPLATES.length} (minutes)`}>
          <Input type="number" inputMode="numeric" min={30} max={480} step={15} value={input.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))} />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className={FIELD_LABEL}>
          {TEMPLATES.needs} <span className={cn('tabular font-normal', sum === input.size ? 'text-fg-3' : 'text-warn')}>· {sum} of {input.size}</span>
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {ROLES.map((r) => (
            <label key={r} className="flex flex-col gap-1 text-[11px] text-fg-3">
              {ROLE_LABELS[r]}
              <input type="number" inputMode="numeric" min={0} max={40} value={input.requirements[r]} onChange={(e) => set('requirements', { ...input.requirements, [r]: Math.max(0, Number(e.target.value) || 0) })} className={cn(CONTROL, 'tabular h-11 px-3')} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={input.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4" />
        {TEMPLATES.active}
      </label>
      {error && (
        <p role="alert" className="text-sm text-stop">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2.5 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          {TEMPLATES.cancel}
        </Button>
        <Button type="submit" loading={saving}>
          {TEMPLATES.save}
        </Button>
      </div>
    </form>
  );
}
