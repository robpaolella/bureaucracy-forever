'use client';

import { useState, type FormEvent } from 'react';
import { Button, Field, Input, Select } from '@/components/ui';
import { CLASS_COLORS, CLASSES, ROLE_LABELS, type WowClass } from '@/lib/design/class-colors';
import { parseCharacterInput, RANK_LABEL, RANKS, reconcileCharacter, rolesFor, specsFor, splitName, type CharacterInput } from '@/lib/roster-edit';
import { EDITOR } from '@/content/roster-editor';

type Props = {
  initial: CharacterInput;
  submitLabel: string;
  /** Resolve with an error message to show, or null when saved. */
  onSubmit: (input: CharacterInput) => Promise<string | null>;
  onCancel: () => void;
  /** Editing an existing main offers removal; adding one does not. */
  onRemove?: () => void;
};

/**
 * A main character: first and second name (WoW Forever names are two parts), class, spec
 * (narrowed by class), raid role (narrowed by spec) and rank. Changing the class or spec keeps the other fields valid rather than letting
 * the form submit a combination the route would refuse.
 */
export function CharacterForm({ initial, submitLabel, onSubmit, onCancel, onRemove }: Props) {
  const [input, setInput] = useState(initial);
  const [names, setNames] = useState(() => splitName(initial.name));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<CharacterInput>) => {
    setInput((v) => reconcileCharacter({ ...v, ...patch }));
    setError(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    const parsed = parseCharacterInput({ ...input, firstName: names.first, secondName: names.second });
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    const message = await onSubmit(parsed.value);
    setSaving(false);
    if (message) setError(message);
  }

  const roles = rolesFor(input.wowClass, input.spec);
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label={EDITOR.firstName} hint={EDITOR.nameHint}>
          <Input
            value={names.first}
            maxLength={12}
            placeholder={EDITOR.namePlaceholder}
            autoComplete="off"
            onChange={(e) => {
              setNames((n) => ({ ...n, first: e.target.value }));
              setError(null);
            }}
          />
        </Field>
        <Field label={EDITOR.secondName}>
          <Input
            value={names.second}
            maxLength={12}
            placeholder={EDITOR.secondNamePlaceholder}
            autoComplete="off"
            onChange={(e) => {
              setNames((n) => ({ ...n, second: e.target.value }));
              setError(null);
            }}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select label={EDITOR.wowClass} options={CLASSES.map((c) => ({ value: c, label: CLASS_COLORS[c].label }))} value={input.wowClass} onChange={(e) => update({ wowClass: e.target.value as WowClass })} />
        <Select label={EDITOR.spec} options={specsFor(input.wowClass).map((s) => ({ value: s, label: s }))} value={input.spec} onChange={(e) => update({ spec: e.target.value })} />
        <Select label={EDITOR.role} options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} value={input.role} disabled={roles.length < 2} onChange={(e) => update({ role: e.target.value as CharacterInput['role'] })} />
        {initial.rank === 'officer' ? (
          <Select label={EDITOR.rank} options={[{ value: 'officer', label: RANK_LABEL.officer }]} value="officer" disabled hint={EDITOR.officerRank} onChange={() => undefined} />
        ) : (
          <Select label={EDITOR.rank} options={RANKS.filter((r) => r !== 'officer').map((r) => ({ value: r, label: RANK_LABEL[r] }))} value={input.rank} onChange={(e) => update({ rank: e.target.value as CharacterInput['rank'] })} />
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-stop">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        {onRemove ? (
          <Button variant="ghost" className="text-stop" onClick={onRemove}>
            {EDITOR.remove}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2.5">
          <Button variant="ghost" onClick={onCancel}>
            {EDITOR.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
