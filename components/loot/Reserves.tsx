'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { DualTime } from '@/components/time/DualTime';
import { Button, Field, useToast } from '@/components/ui';
import { CONTROL } from '@/components/ui/Field';
import { SAVE_FAILED } from '@/content/calendar';
import { RESERVES } from '@/content/reserves';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import type { LootTableView, ReserveTargetRow, ReserveView } from '@/lib/loot-data';
import { draftPickFor, reserveHolders } from '@/lib/loot-rules';
import { ItemName } from './ItemName';
import { ReservePicker, ReserverCount, type OwnMark } from './ReservePicker';

/** A member whose reserves the viewer may set: themselves, or anyone eligible for an officer. */
export type ReserveTarget = ReserveTargetRow;

type Props = {
  raidId: string;
  table: LootTableView;
  reserves: ReserveView[];
  lockAt: string;
  locked: boolean;
  cancelled: boolean;
  officer: boolean;
  /** Empty when the viewer has nothing to set (not eligible, or no characters). */
  targets: ReserveTarget[];
  /** Why the viewer cannot reserve, when `targets` is empty. */
  reason: string | null;
};

/** Raid detail § Loot reserves: the picker and everyone's reserves, visible to all members. */
export function Reserves({ raidId, table, reserves, lockAt, locked, cancelled, officer, targets, reason }: Props) {
  const [targetId, setTargetId] = useState(targets.find((t) => t.self)?.userId ?? targets[0]?.userId);
  const target = targets.find((t) => t.userId === targetId) ?? targets[0];
  const canEdit = !cancelled && target && (!locked || officer);
  const holders = useMemo(() => reserveHolders(reserves), [reserves]);
  const mark = target && { userId: target.userId, label: target.self ? RESERVES.yours : RESERVES.editing };
  return (
    <section id="loot-reserves" className="flex scroll-mt-24 flex-col gap-5 rounded-card border border-line bg-ink-850 p-4 md:p-5" aria-labelledby="reserves-heading">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <h2 id="reserves-heading" className="font-display text-2xl font-medium">
          {RESERVES.heading}
        </h2>
        {!cancelled && (
          <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{RESERVES.locksAt}</span>
            <DualTime startsAt={lockAt} durationMin={0} />
          </span>
        )}
      </div>
      <p className="max-w-[720px] text-sm text-fg-2">{RESERVES.lede}</p>
      {cancelled ? (
        <p className="text-sm text-stop">{RESERVES.cancelled}</p>
      ) : locked ? (
        <p className="text-sm text-warn">{RESERVES.locked}</p>
      ) : null}
      {canEdit ? <PickerForm key={target.userId} raidId={raidId} table={table} holders={holders} mark={mark} target={target} targets={targets} onTarget={setTargetId} /> : !cancelled && !locked && reason && <p className="text-sm text-fg-3">{reason}</p>}
      <ReserveList table={table} holders={holders} mark={mark} />
    </section>
  );
}

type Holders = ReturnType<typeof reserveHolders<ReserveView>>;
type FormProps = { raidId: string; table: LootTableView; holders: Holders; mark: OwnMark; target: ReserveTarget; targets: ReserveTarget[]; onTarget: (id: string) => void };

function PickerForm({ raidId, table, holders, mark, target, targets, onTarget }: FormProps) {
  const router = useRouter();
  const toast = useToast();
  const main = target.characters.find((c) => c.isMain) ?? target.characters[0];
  const [characterId, setCharacterId] = useState(target.current.characterId ?? main.id);
  const [hr, setHr] = useState<number | null>(target.current.hr);
  const [sr, setSr] = useState<number | null>(target.current.sr);
  const [busy, setBusy] = useState(false);

  // The picker's names and counts describe saved reserves, including the member being edited, not the draft.
  const won = new Set(target.blockedHr[characterId] ?? []);

  async function save(next: { hr: number | null; sr: number | null }) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/raids/${raidId}/reserves`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ characterId, ...next, forUserId: target.self ? undefined : target.userId }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        toast({ tone: 'stop', title: body?.error ?? SAVE_FAILED });
        return;
      }
      if (next.hr === null && next.sr === null) {
        setHr(null);
        setSr(null);
      }
      toast({ tone: 'ok', title: next.hr === null && next.sr === null ? RESERVES.cleared : target.self ? RESERVES.saved : RESERVES.savedFor(target.name) });
      router.refresh();
    } catch {
      toast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (hr !== null && hr === sr) {
      toast({ tone: 'stop', title: RESERVES.sameItem });
      return;
    }
    void save({ hr, sr });
  }

  const select = cn(CONTROL, 'h-[46px] min-w-0 px-3');
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-line-faint bg-ink-900 p-4">
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {targets.length > 1 && (
          <Field label={RESERVES.forWhom}>
            <select className={select} value={target.userId} onChange={(e) => onTarget(e.target.value)}>
              {targets.map((t) => (
                <option key={t.userId} value={t.userId}>
                  {t.self ? RESERVES.you(t.name) : t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={RESERVES.character}>
          <select
            className={select}
            value={characterId}
            onChange={(e) => {
              const next = e.target.value;
              setCharacterId(next);
              // Neither reserve may select an item this character already won through HR or SR,
              // and a pick on a blocked item is kept only for the character it was saved with.
              const rules = { won: target.blockedHr[next] ?? [], blocked: table.blocked, saved: target.current };
              setHr(draftPickFor('HR', hr, next, rules));
              setSr(draftPickFor('SR', sr, next, rules));
            }}
          >
            {target.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {CLASS_COLORS[c.wowClass].label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <ReservePicker table={table} holders={holders} mark={mark} won={won} hr={hr} sr={sr}
        forName={target.self ? null : target.name}
        onChange={(kind, itemId) => { if (kind === 'HR') setHr(itemId); else setSr(itemId); }} />
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={busy}>{RESERVES.save}</Button>
      </div>
    </form>
  );
}

/** Everyone's reserves by item, hard reserves first; each count opens the names. */
function ReserveList({ table, holders, mark }: { table: LootTableView; holders: Holders; mark?: OwnMark }) {
  const rows = [...holders.entries()]
    .filter(([id]) => table.items[id])
    .sort(([a, ha], [b, hb]) => hb.HR.length - ha.HR.length || table.items[a].name.localeCompare(table.items[b].name));
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{RESERVES.listHeading}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-3">{RESERVES.listEmpty}</p>
      ) : (
        <ul className="divide-y divide-line-faint rounded-card border border-line-faint">
          {rows.map(([itemId, list]) => {
            const item = table.items[itemId];
            const own = mark && (['HR', 'SR'] as const).find((kind) => list[kind].some((r) => r.userId === mark.userId));
            return (
              <li key={itemId} className="flex items-center gap-2 px-3 py-1">
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
                  <ItemName item={item} className="text-sm" />
                  {own && <span className={cn('text-xs font-semibold', own === 'HR' ? 'text-sand' : 'text-teal')}>
                    {mark.label}<span className="sr-only"> ({own === 'HR' ? RESERVES.hr : RESERVES.sr})</span>
                  </span>}
                </span>
                {(['HR', 'SR'] as const).map((kind) => list[kind].length > 0 && <ReserverCount key={kind} kind={kind} item={item.name} list={list[kind]} mark={mark} />)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
