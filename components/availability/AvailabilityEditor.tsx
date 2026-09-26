'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, Toast, type ToastData } from '@/components/ui';
import { AVAILABILITY_HEAD, AVAILABILITY_LEGEND_NOTE } from '@/content/availability';
import {
  applyPaint,
  countStates,
  offsetDescription,
  relativeTime,
  serverOffsetSlots,
  slotKey,
  weekDays,
  weekStart,
  type PaintMode,
  type SlotState,
  type Week,
  type WeekDay,
} from '@/lib/availability';
import { cn } from '@/lib/cn';
import { REALM_TIMEZONE } from '@/lib/config';
import { zoneAbbreviation } from '@/lib/time';
import { DayColumn } from './DayColumn';
import { DayListModal } from './DayListModal';
import { WeekGrid } from './WeekGrid';

export type StoredAvailability = { timezone: string; slots: Week; updatedAt: string };

type Props = { initial: StoredAvailability | null };

const MODES: Array<{ mode: PaintMode; label: string; chip: string }> = [
  { mode: 'available', label: 'Available', chip: 'bg-slot-available' },
  { mode: 'if-needed', label: 'If needed', chip: 'bg-slot-ifNeeded' },
  { mode: 'erase', label: 'Erase', chip: 'bg-slot-empty border border-line-strong' },
];

const AUTOSAVE_MS = 2000;

/** Status dot and label beside the Save button. Tone is "dot-class text-class". */
function SaveControl({ className, label, tone, saving, onSave }: { className?: string; label: string; tone: string; saving: boolean; onSave: () => void }) {
  const [dot, text] = tone.split(' ');
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span className={cn('flex items-center gap-2 text-[13px]', text)}>
        <span aria-hidden className={cn('h-[7px] w-[7px] rounded-full', dot)} />
        <span role="status">{label}</span>
      </span>
      <Button onClick={onSave} loading={saving} className="font-bold">
        Save
      </Button>
    </div>
  );
}

/**
 * The member availability page below the shell (docs/05 § Member view). Owns the week,
 * the paint mode, dirty/saved state, autosave, the keyboard alternative and the toast.
 * Slots are kept in `zone`, the zone they were painted in; a viewer detected elsewhere is
 * asked, never switched silently (docs/06 § Timezone handling).
 */
export function AvailabilityEditor({ initial }: Props) {
  const viewer = useViewerTimeZone();
  // The zone the week is painted in: the stored one, else the viewer's for a first-time painter.
  const [storedZone, setStoredZone] = useState(initial?.timezone ?? null);
  const zone = storedZone ?? viewer?.zone ?? null;
  const effectiveZone = zone ?? REALM_TIMEZONE;
  const [week, setWeek] = useState<Week>(initial?.slots ?? {});
  const [mode, setMode] = useState<PaintMode>('available');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(initial ? new Date(initial.updatedAt) : null);
  const [now, setNow] = useState(() => new Date());
  const [openDay, setOpenDay] = useState<WeekDay | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [zonePromptDismissed, setZonePromptDismissed] = useState(false);
  const version = useRef(0);
  const saveRef = useRef<(announce: boolean) => Promise<void>>(async () => {});
  // Mirrors `saving` for the unload flush, which runs outside React's render cycle.
  const savingRef = useRef(false);

  // The relative "Last saved" label re-renders on a 30s interval.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => weekDays(now, effectiveZone), [now, effectiveZone]);
  const offsetSlots = useMemo(() => serverOffsetSlots(weekStart(now, effectiveZone), effectiveZone), [now, effectiveZone]);
  const counts = countStates(week);

  const change = useCallback((next: Week) => {
    version.current += 1;
    setWeek(next);
    setDirty(true);
  }, []);

  const paintCell = useCallback(
    (key: string) => {
      setWeek((current) => {
        const next = applyPaint(current, key, mode);
        if (next !== current) {
          version.current += 1;
          setDirty(true);
        }
        return next;
      });
    },
    [mode],
  );

  const setSlot = useCallback(
    (day: number, slot: number, state: SlotState | null) => {
      setWeek((current) => {
        const next = applyPaint(current, slotKey(day, slot), state ?? 'erase');
        if (next !== current) {
          version.current += 1;
          setDirty(true);
        }
        return next;
      });
    },
    [],
  );

  const save = useCallback(
    async (announce: boolean) => {
      if (!zone) return;
      const at = version.current;
      setSaving(true);
      savingRef.current = true;
      try {
        // keepalive: a save that is in flight when the tab closes still completes.
        const res = await fetch('/api/availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone: zone, slots: week }),
          keepalive: true,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const saved = (await res.json()) as StoredAvailability;
        setLastSavedAt(new Date(saved.updatedAt));
        setNow(new Date());
        if (version.current === at) setDirty(false);
        if (announce) setToast({ tone: 'ok', title: 'Week saved', detail: `${counts.available} available · ${counts.ifNeeded} if needed` });
      } catch {
        setToast({ tone: 'stop', title: "Couldn't save that — try again.", action: { label: 'Retry', onClick: () => void saveRef.current(true) } });
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [zone, week, counts.available, counts.ifNeeded],
  );
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  // Autosave 2s after the last change. The Save button is reassurance, not the only path.
  useEffect(() => {
    if (!dirty || saving) return;
    const t = setTimeout(() => void save(false), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, saving, week, zone, save]);

  // Leaving inside the debounce: warn, and push the week with a keepalive request so a
  // paint made a second before closing the tab is not lost silently. Never while a save
  // is in flight: two overlapping PUTs could land out of order and persist the older
  // week. The in-flight save is itself keepalive, and if it leaves the week dirty the
  // autosave effect reschedules once it settles.
  useEffect(() => {
    if (!dirty || !zone) return;
    const flush = () => {
      if (savingRef.current) return;
      void fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: zone, slots: week }),
        keepalive: true,
      }).catch(() => {});
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      flush();
      e.preventDefault();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [dirty, zone, week]);

  const savedLabel = dirty ? 'Unsaved changes' : saving ? 'Saving…' : lastSavedAt ? `Last saved ${relativeTime(lastSavedAt, now)}` : 'Nothing saved yet';
  const dotTone = dirty ? 'bg-warn text-warn' : lastSavedAt ? 'bg-ok text-ok' : 'bg-fg-3 text-fg-3';
  const dismissToast = useCallback(() => setToast(null), []);

  const zoneMismatch = storedZone && viewer && viewer.zone !== storedZone && !zonePromptDismissed;

  const saveControl = (className?: string) => (
    <SaveControl className={className} label={savedLabel} tone={dotTone} saving={saving} onSave={() => void save(true)} />
  );

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-8 md:px-12 md:pb-10 md:pt-11">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-12">
        <div className="flex flex-col gap-3">
          <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{AVAILABILITY_HEAD.eyebrow}</span>
          <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{AVAILABILITY_HEAD.title}</h1>
          <p className="max-w-[620px] text-[15px] leading-[1.65] text-fg-2">{AVAILABILITY_HEAD.lede}</p>
        </div>
        {saveControl('hidden md:flex')}
      </section>

      {zoneMismatch && (
        <div role="status" className="flex flex-col gap-3 rounded-card border border-teal-line bg-teal-wash px-5 py-4 text-sm text-teal-text sm:flex-row sm:items-center sm:justify-between">
          <span>
            Looks like you&apos;re in <span className="font-semibold text-fg">{viewer.zone}</span> now. Your week is saved in{' '}
            <span className="font-semibold text-fg">{storedZone}</span>. Update your timezone?
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setStoredZone(viewer.zone);
                version.current += 1;
                setDirty(true);
                setZonePromptDismissed(true);
              }}
            >
              Use {viewer.zone}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setZonePromptDismissed(true)}>
              Keep {storedZone}
            </Button>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="mr-1.5 hidden text-label font-semibold uppercase text-fg-3 md:inline">Paint</span>
          <div className="grid w-full grid-cols-3 gap-2 md:flex md:w-auto md:gap-2.5" role="radiogroup" aria-label="Paint mode">
            {MODES.map((m) => (
              <button
                key={m.mode}
                type="button"
                role="radio"
                aria-checked={mode === m.mode}
                onClick={() => setMode(m.mode)}
                className={cn(
                  'flex h-11 items-center justify-center gap-2.5 rounded-control border px-3 text-sm font-semibold transition-colors duration-[120ms] md:justify-start md:px-4',
                  mode === m.mode ? 'border-teal bg-teal-wash' : 'border-line-strong bg-ink-800 hover:bg-ink-700',
                )}
              >
                <span aria-hidden className={cn('h-3.5 w-3.5 rounded-tag', m.chip)} />
                {m.label}
              </button>
            ))}
          </div>
          <div className="mx-1.5 hidden h-7 w-px bg-line md:block" aria-hidden />
          <Button variant="ghost" size="sm" className="hidden border border-line md:inline-flex" onClick={() => change({})}>
            Clear week
          </Button>
        </div>
        <div className="flex items-center gap-7 md:text-right">
          <div className="flex flex-col gap-[3px]">
            <span className="text-label font-semibold uppercase text-teal">Your time</span>
            <span className="text-sm font-semibold">
              {effectiveZone} · {zoneAbbreviation(now, effectiveZone)}{' '}
              <span className="font-normal text-fg-3">{storedZone && viewer && viewer.zone !== storedZone ? 'saved' : viewer?.source === 'chosen' ? 'chosen' : 'detected'}</span>
            </span>
          </div>
          <div className="flex flex-col gap-[3px]">
            <span className="text-label font-semibold uppercase text-sand">Server</span>
            <span className="tabular text-sm font-semibold text-fg-2">
              {zoneAbbreviation(now, REALM_TIMEZONE)} · {offsetDescription(offsetSlots)}
            </span>
          </div>
        </div>
      </section>

      <div className="hidden md:block">
        <WeekGrid week={week} days={days} offsetSlots={offsetSlots} paintCell={paintCell} onOpenDay={setOpenDay} />
      </div>
      <div className="md:hidden">
        <DayColumn week={week} days={days} offsetSlots={offsetSlots} mode={mode} onWeek={change} onOpenDay={setOpenDay} />
      </div>

      <section className="flex flex-col gap-3 text-[13px] text-fg-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-3.5 rounded-tag bg-slot-available" />
            Available — <span className="tabular">{counts.available}</span> half-hours
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-3.5 rounded-tag bg-slot-ifNeeded" />
            If needed — <span className="tabular">{counts.ifNeeded}</span> half-hours
          </span>
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-3.5 rounded-tag border border-line bg-slot-empty" />
            Not available
          </span>
        </div>
        <span className="text-fg-3">{AVAILABILITY_LEGEND_NOTE}</span>
      </section>

      {/* Mobile save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-line bg-ink-900 px-4 py-3 md:hidden">
        {saveControl('w-full justify-between')}
      </div>

      <DayListModal day={openDay} week={week} offsetSlots={offsetSlots} onSet={setSlot} onClose={() => setOpenDay(null)} />
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
