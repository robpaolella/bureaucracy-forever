'use client';

import { useId, useState, type FormEvent } from 'react';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, CONTROL, Field, FIELD_LABEL, Input, Select, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { GUILD_TIMEZONE } from '@/lib/config';
import { ROLE_LABELS, ROLES } from '@/lib/design/class-colors';
import { DURATIONS, parseRaidInput, RAID_NAME_MAX, RAID_NOTES_MAX, type RaidInput } from '@/lib/raids';
import { formatRange, WEEKDAY_NAMES, zoneAbbreviation, zonedParts } from '@/lib/time';
import { SCHEDULE_FORM } from '@/content/calendar';

type Props = {
  initial: RaidInput;
  submitLabel: string;
  /** Resolve with an error message to show, or null when saved. */
  onSubmit: (input: RaidInput) => Promise<string | null>;
  onCancel: () => void;
};

const DURATION_LABEL = (min: number) => (min % 60 === 0 ? `${min / 60} hours` : `${Math.floor(min / 60)}½ hours`);

/**
 * Name, guild-time date and start, length, the four requirements and notes. The wall
 * clock is entered in guild time (docs/01 § Time: one configured zone) and previewed in
 * the officer's own zone beneath, so nothing is ever a bare time. Validation is the same
 * `parseRaidInput` the route runs, so the form never shows an error the server would not.
 */
export function RaidForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const viewer = useViewerTimeZone();
  const reqId = useId();

  const parsed = parseRaidInput(input);
  // The preview only needs the date and time; a blank name must not hide it.
  const previewParse = parsed.ok ? parsed : parseRaidInput({ ...input, name: input.name.trim() || SCHEDULE_FORM.namePlaceholder });
  const preview = previewParse.ok ? previewParse.startsAt : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    const message = await onSubmit(parsed.value);
    setSaving(false);
    if (message) setError(message);
  }

  const set = <K extends keyof RaidInput>(key: K, value: RaidInput[K]) => {
    setInput((v) => ({ ...v, [key]: value }));
    setError(null);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label={SCHEDULE_FORM.name}>
        <Input value={input.name} maxLength={RAID_NAME_MAX} placeholder={SCHEDULE_FORM.namePlaceholder} autoComplete="off" onChange={(e) => set('name', e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={SCHEDULE_FORM.date}>
          <Input type="date" value={input.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={SCHEDULE_FORM.time} hint={SCHEDULE_FORM.guildHint}>
          <Input type="time" step={1800} value={input.time} onChange={(e) => set('time', e.target.value)} />
        </Field>
      </div>

      <Select label={SCHEDULE_FORM.duration} options={DURATIONS.map((d) => ({ value: String(d), label: DURATION_LABEL(d) }))} value={String(input.durationMin)} onChange={(e) => set('durationMin', Number(e.target.value))} />

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
                  set('requirements', { ...input.requirements, [r]: Number.isNaN(n) ? 0 : n });
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

      <p className="tabular text-sm text-fg-2" aria-live="polite">
        <span className="text-fg-3">{SCHEDULE_FORM.preview} </span>
        {preview ? (
          <>
            <span className="font-semibold text-fg">
              {WEEKDAY_NAMES[zonedParts(preview, GUILD_TIMEZONE).weekday]} {formatRange(preview, new Date(preview.getTime() + input.durationMin * 60_000), GUILD_TIMEZONE)}
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
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
