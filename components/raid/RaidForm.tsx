'use client';

import { useId, useState, type FormEvent } from 'react';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, CONTROL, Field, FIELD_LABEL, Input, Select, Textarea, TextLink, Toggle } from '@/components/ui';
import { cn } from '@/lib/cn';
import { GUILD_TIMEZONE } from '@/lib/config';
import { ROLE_LABELS, ROLES } from '@/lib/design/class-colors';
import { durationLabel, durationOptions, parseRaidInput, RAID_NOTES_MAX, type RaidInput, type RaidTemplateOption } from '@/lib/raids';
import { instanceName } from '@/lib/series';
import { formatRange, WEEKDAY_NAMES, zoneAbbreviation, zonedParts } from '@/lib/time';
import { SCHEDULE_FORM } from '@/content/calendar';

type Props = {
  initial: RaidInput;
  /** The templates to pick from: the active ones, or just the raid's own when `templateLocked`. */
  templates: RaidTemplateOption[];
  /** The raid already has a template; it is shown but cannot change. */
  templateLocked?: boolean;
  /** Loot is on: the Reserves allowed switch shows and is sent. Off, it is neither. */
  lootOn?: boolean;
  submitLabel: string;
  /** Resolve with an error message to show, or null when saved. */
  onSubmit: (input: RaidInput) => Promise<string | null>;
  onCancel: () => void;
};

/**
 * Template, guild-time date and start, length, the four requirements and notes. The wall
 * clock is entered in guild time (docs/01 § Time: one configured zone) and previewed in
 * the officer's own zone beneath, so nothing is ever a bare time. Validation is the same
 * `parseRaidInput` the route runs, so the form never shows an error the server would not.
 */
export function RaidForm({ initial, templates, templateLocked = false, lootOn = false, submitLabel, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const viewer = useViewerTimeZone();
  const reqId = useId();

  const parsed = parseRaidInput(input);
  const template = templates.find((t) => t.id === input.templateId);
  // The preview only needs the date and time; a blank template must not hide it.
  const previewParse = parsed.ok ? parsed : parseRaidInput({ ...input, templateId: input.templateId || 'preview' });
  const preview = previewParse.ok ? previewParse.startsAt : null;
  const noTemplates = templates.length === 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || noTemplates) return;
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    const { reservesAllowed, ...rest } = parsed.value;
    const message = await onSubmit(lootOn ? { ...rest, reservesAllowed: reservesAllowed ?? true } : rest);
    setSaving(false);
    if (message) setError(message);
  }

  const set = <K extends keyof RaidInput>(key: K, value: RaidInput[K]) => {
    setInput((v) => ({ ...v, [key]: value }));
    setError(null);
  };

  /** Picking a template fills Length and Needed from it, replacing whatever was there. */
  const pick = (id: string) => {
    const t = templates.find((x) => x.id === id);
    setInput((v) => ({ ...v, templateId: id, ...(t ? { durationMin: t.durationMin, requirements: t.requirements } : {}) }));
    setError(null);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {noTemplates ? (
        <p className="text-sm text-fg-2">
          {SCHEDULE_FORM.templateNeeded}{' '}
          <TextLink href="/officers/raids">{SCHEDULE_FORM.templateNeededLink}</TextLink>
        </p>
      ) : (
        <Select
          label={SCHEDULE_FORM.template}
          options={[...(templateLocked ? [] : [{ value: '', label: SCHEDULE_FORM.templatePlaceholder }]), ...templates.map((t) => ({ value: t.id, label: t.name }))]}
          value={input.templateId}
          disabled={templateLocked}
          hint={templateLocked ? SCHEDULE_FORM.templateLocked : undefined}
          onChange={(e) => pick(e.target.value)}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={SCHEDULE_FORM.date}>
          <Input type="date" value={input.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={SCHEDULE_FORM.time} hint={SCHEDULE_FORM.guildHint}>
          <Input type="time" step={1800} value={input.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
      </div>

      <Select label={SCHEDULE_FORM.duration} options={durationOptions(input.durationMin).map((d) => ({ value: String(d), label: durationLabel(d) }))} value={String(input.durationMin)} onChange={(e) => set('durationMin', Number(e.target.value))} />

      <fieldset className="flex flex-col gap-2">
        <legend className={FIELD_LABEL}>{SCHEDULE_FORM.requirements}</legend>
        <div className="grid grid-cols-4 gap-2">
          {ROLES.map((r) => (
            <div key={r} className="flex flex-col gap-1">
              <label htmlFor={`${reqId}-${r}`} className="text-[11px] text-fg-3">
                {ROLE_LABELS[r]}
              </label>
              <input
                id={`${reqId}-${r}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={40}
                value={input.requirements[r]}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  set('requirements', { ...input.requirements, [r]: Number.isNaN(n) || n < 0 ? 0 : n });
                }}
                className={cn(CONTROL, 'tabular h-11 px-3')}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <Field label={SCHEDULE_FORM.notes} hint={SCHEDULE_FORM.notesHint}>
        <Textarea rows={3} maxLength={RAID_NOTES_MAX} value={input.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      {lootOn && <Toggle label={SCHEDULE_FORM.reservesAllowed} checked={input.reservesAllowed ?? true} onChange={(on) => set('reservesAllowed', on)} />}

      <p className="tabular text-sm text-fg-2" aria-live="polite">
        <span className="text-fg-3">{SCHEDULE_FORM.preview} </span>
        {preview ? (
          <>
            <span className="font-semibold text-fg">
              {template ? instanceName(template.name, preview) : WEEKDAY_NAMES[zonedParts(preview, GUILD_TIMEZONE).weekday]} · {formatRange(preview, new Date(preview.getTime() + input.durationMin * 60_000), GUILD_TIMEZONE)}
            </span>{' '}
            <span className="text-fg-3">guild ({zoneAbbreviation(preview, GUILD_TIMEZONE)})</span>
            {viewer && viewer.zone !== GUILD_TIMEZONE && (
              <span className="text-teal-text"> · {formatRange(preview, new Date(preview.getTime() + input.durationMin * 60_000), viewer.zone)} yours</span>
            )}
          </>
        ) : (
          <span className="text-fg-3">—</span>
        )}
      </p>

      {error && (
        <p role="alert" className="text-sm text-stop">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2.5 pt-1">
        <Button variant="ghost" onClick={onCancel}>
          {SCHEDULE_FORM.cancel}
        </Button>
        <Button type="submit" loading={saving} disabled={noTemplates}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
