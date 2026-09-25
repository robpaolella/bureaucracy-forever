'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useId, useState } from 'react';
import { submitApplication } from '@/app/(site)/recruitment/actions';
import { INITIAL_STATE, type ApplicationPath } from '@/components/recruitment/form-state';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, Choice, ChoiceGroup, Field, Input, Select, Textarea } from '@/components/ui';
import { FORM } from '@/content/recruitment';
import { RAID_NIGHTS } from '@/content/schedule';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, CLASSES, SPECS, type WowClass } from '@/lib/design/class-colors';
import { formatRangeShort, formatRealmRangeShort, minutesBetween, nextOccurrence, WEEKDAY_NAMES } from '@/lib/time';

type Props = {
  /** From the session when logged in; the field is then read-only. */
  discordHandle?: string;
};

/** The progression nights, derived from the schedule so the question tracks the real times. */
const PROGRESSION = RAID_NIGHTS.filter((n) => !n.optional);
const AVAILABILITY_QUESTION = `Can you make ${PROGRESSION.map((n) => WEEKDAY_NAMES[n.day]).join(' and ')}, ${formatRealmRangeShort(
  PROGRESSION[0].start,
  PROGRESSION[0].end,
)} server?`;

function PathCard({ value, title, text, checked, onChange }: { value: ApplicationPath; title: string; text: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer flex-col items-start gap-1.5 rounded-md border px-5 py-[18px] text-left transition-colors duration-[120ms]',
        // The radio is visually hidden, so the card carries its focus ring.
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-ink-850',
        checked ? 'border-teal bg-teal-wash' : 'border-line-strong bg-ink-800 hover:bg-ink-700',
      )}
    >
      <input type="radio" name="path" value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="text-base font-semibold">{title}</span>
      <span className={cn('text-[13px] leading-[1.5]', checked ? 'text-teal-text' : 'text-fg-2')}>{text}</span>
    </label>
  );
}

function LocalNightsLine() {
  const viewer = useViewerTimeZone();
  if (!viewer) return <span className="text-teal">&nbsp;</span>;
  const night = PROGRESSION[0];
  const start = nextOccurrence(night.day, night.start);
  const end = new Date(start.getTime() + minutesBetween(night.start, night.end) * 60_000);
  return (
    <span className="text-teal">
      Your local time: <span className="tabular">{formatRangeShort(start, end, viewer.zone)}</span>, {viewer.zone}.
    </span>
  );
}

export function ApplicationForm({ discordHandle }: Props) {
  const params = useSearchParams();
  const [path, setPath] = useState<ApplicationPath>(params.get('path') === 'social' ? 'social' : 'raider');
  const [wowClass, setWowClass] = useState<WowClass | ''>('');
  const [state, formAction, pending] = useActionState(submitApplication, INITIAL_STATE);
  const agreeErrorId = useId();
  const e = state.errors;

  const classOptions = [{ value: '', label: 'Choose a class' }, ...CLASSES.map((c) => ({ value: c, label: CLASS_COLORS[c].label }))];
  const specOptions = [
    { value: '', label: wowClass ? 'Choose a spec' : 'Choose a class first' },
    ...(wowClass ? SPECS[wowClass].map((s) => ({ value: s.name, label: s.name })) : []),
  ];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6 rounded-card border border-line bg-ink-850 p-6 md:p-10">
      <div className="flex flex-col gap-2.5">
        <h2 className="font-display text-[34px] font-medium leading-[1.1]">{FORM.title}</h2>
        <p className="text-[15px] leading-[1.65] text-fg-2">{FORM.lede}</p>
      </div>

      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="sr-only">Application path</legend>
        <PathCard value="raider" {...FORM.paths.raider} checked={path === 'raider'} onChange={() => setPath('raider')} />
        <PathCard value="social" {...FORM.paths.social} checked={path === 'social'} onChange={() => setPath('social')} />
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Character name" error={e.character}>
          <Input name="character" placeholder="As it appears in game" autoComplete="off" required />
        </Field>
        <Field
          label="Discord handle"
          hint={discordHandle ? 'From your Discord login.' : 'Log in with Discord to fill this in automatically.'}
          error={e.discord}
        >
          <Input name="discord" defaultValue={discordHandle} readOnly={Boolean(discordHandle)} placeholder="yourhandle" autoComplete="off" />
        </Field>
        {path === 'raider' && (
          <>
            <Select
              label="Class"
              name="class"
              options={classOptions}
              value={wowClass}
              onChange={(ev) => setWowClass(ev.target.value as WowClass | '')}
              error={e.class}
              required
            />
            <Select label="Main spec" name="spec" options={specOptions} error={e.spec} key={wowClass} required />
          </>
        )}
      </div>

      {path === 'raider' ? (
        <>
          <Field label="Logs" hint={FORM.logsHint} error={e.logs}>
            <Input name="logs" type="url" placeholder="https://" inputMode="url" required />
          </Field>

          <ChoiceGroup legend={AVAILABILITY_QUESTION} row error={e.availability} hint={<LocalNightsLine />}>
            {FORM.availabilityOptions.map((opt) => (
              <Choice key={opt} card type="radio" name="availability" value={opt} label={opt} className="w-auto px-4" required />
            ))}
          </ChoiceGroup>

          <Field label={FORM.wipeQuestion} error={e.wipe}>
            <Textarea name="wipe" rows={5} placeholder={FORM.wipePlaceholder} required />
          </Field>

          <div className="flex flex-col gap-1.5">
            <Choice
              type="checkbox"
              name="agree"
              required
              aria-describedby={e.agree ? agreeErrorId : undefined}
              aria-invalid={e.agree ? true : undefined}
              label={
                <>
                  I have read the{' '}
                  <Link href="/loot" className="text-teal hover:brightness-110">
                    loot rules
                  </Link>{' '}
                  and the raider expectations above.
                </>
              }
            />
            {e.agree && (
              <span id={agreeErrorId} className="text-xs text-stop">
                {e.agree}
              </span>
            )}
          </div>
        </>
      ) : (
        <Field label={FORM.socialQuestion}>
          <Textarea name="note" rows={4} placeholder={FORM.socialPlaceholder} />
        </Field>
      )}

      {state.message && (
        <p role="status" className="rounded-card border border-teal-line bg-teal-wash px-5 py-4 text-sm leading-relaxed text-teal-text">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:gap-4">
        <Button type="submit" size="lg" loading={pending} className="font-bold">
          {FORM.submit}
        </Button>
        <span className="text-[13px] text-fg-3">{FORM.submitNote}</span>
      </div>
    </form>
  );
}
