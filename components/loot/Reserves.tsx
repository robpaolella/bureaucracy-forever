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
import { reserveCounts, type ReserveKind } from '@/lib/loot-rules';
import { ItemName } from './ItemName';

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
  const canEdit = !cancelled && targets.length > 0 && (!locked || officer);
  return (
    <section className="flex flex-col gap-5 rounded-card border border-line bg-ink-850 p-4 md:p-5" aria-labelledby="reserves-heading">
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
      {canEdit ? <Picker raidId={raidId} table={table} reserves={reserves} targets={targets} /> : !cancelled && !locked && reason && <p className="text-sm text-fg-3">{reason}</p>}
      <ReserveList table={table} reserves={reserves} />
    </section>
  );
}

function Picker({ raidId, table, reserves, targets }: { raidId: string; table: LootTableView; reserves: ReserveView[]; targets: ReserveTarget[] }) {
  const [targetId, setTargetId] = useState(targets.find((t) => t.self)?.userId ?? targets[0].userId);
  const target = targets.find((t) => t.userId === targetId) ?? targets[0];
  // Keyed by member so switching whom an officer edits starts from that member's saved reserves.
  return <PickerForm key={target.userId} raidId={raidId} table={table} reserves={reserves} target={target} targets={targets} onTarget={setTargetId} />;
}

type FormProps = { raidId: string; table: LootTableView; reserves: ReserveView[]; target: ReserveTarget; targets: ReserveTarget[]; onTarget: (id: string) => void };

function PickerForm({ raidId, table, reserves, target, targets, onTarget }: FormProps) {
  const router = useRouter();
  const toast = useToast();
  const main = target.characters.find((c) => c.isMain) ?? target.characters[0];
  const [characterId, setCharacterId] = useState(target.current.characterId ?? main.id);
  const [hr, setHr] = useState<number | null>(target.current.hr);
  const [sr, setSr] = useState<number | null>(target.current.sr);
  const [busy, setBusy] = useState(false);

  // Counts for the option labels, without this member's own saved reserves.
  const counts = useMemo(() => reserveCounts(reserves.filter((r) => r.userId !== target.userId)), [reserves, target.userId]);
  const blocked = new Set(target.blockedHr[characterId] ?? []);

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

  const itemOptions = (kind: ReserveKind, other: number | null) => {
    const seen = new Set<number>();
    return table.bosses.map((boss) => {
      const ids = boss.itemIds.filter((id) => !seen.has(id) && seen.add(id));
      if (ids.length === 0) return null;
      return (
        <optgroup key={boss.id} label={boss.name}>
          {ids.map((id) => {
            const c = counts.get(id) ?? { HR: 0, SR: 0 };
            const isBlocked = kind === 'HR' && blocked.has(id);
            return (
              <option key={id} value={id} disabled={id === other || isBlocked}>
                {table.items[id].name}
                {RESERVES.counts(c.HR, c.SR)}
                {isBlocked ? ` — ${RESERVES.blocked}` : ''}
              </option>
            );
          })}
        </optgroup>
      );
    });
  };

  const select = cn(CONTROL, 'h-[46px] px-3');
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-card border border-line-faint bg-ink-900 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              // This character may not hard-reserve an item it already won with HR.
              if (hr !== null && (target.blockedHr[next] ?? []).includes(hr)) setHr(null);
            }}
          >
            {target.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {CLASS_COLORS[c.wowClass].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={RESERVES.hr}>
          <select className={select} value={hr ?? ''} onChange={(e) => setHr(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{RESERVES.none}</option>
            {itemOptions('HR', sr)}
          </select>
        </Field>
        <Field label={RESERVES.sr}>
          <select className={select} value={sr ?? ''} onChange={(e) => setSr(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{RESERVES.none}</option>
            {itemOptions('SR', hr)}
          </select>
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        {hr !== null && table.items[hr] && (
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold text-sand">{RESERVES.hrShort}</span>
            <ItemName item={table.items[hr]} />
          </span>
        )}
        {sr !== null && table.items[sr] && (
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold text-teal">{RESERVES.srShort}</span>
            <ItemName item={table.items[sr]} />
          </span>
        )}
        <div className="ml-auto flex gap-2.5">
          <Button variant="ghost" size="sm" disabled={busy || (target.current.hr === null && target.current.sr === null)} onClick={() => save({ hr: null, sr: null })}>
            {RESERVES.clear}
          </Button>
          <Button type="submit" size="sm" loading={busy}>
            {RESERVES.save}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Everyone's reserves by item, hard reserves first. */
function ReserveList({ table, reserves }: { table: LootTableView; reserves: ReserveView[] }) {
  const byItem = new Map<number, ReserveView[]>();
  for (const r of reserves) {
    const list = byItem.get(r.itemId) ?? [];
    list.push(r);
    byItem.set(r.itemId, list);
  }
  const rows = [...byItem.entries()]
    .filter(([id]) => table.items[id])
    .sort(([a, ra], [b, rb]) => rb.filter((r) => r.kind === 'HR').length - ra.filter((r) => r.kind === 'HR').length || table.items[a].name.localeCompare(table.items[b].name));
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{RESERVES.listHeading}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-3">{RESERVES.listEmpty}</p>
      ) : (
        <ul className="divide-y divide-line-faint rounded-card border border-line-faint">
          {rows.map(([itemId, list]) => (
            <li key={itemId} className="grid gap-x-4 gap-y-1 px-3 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
              <ItemName item={table.items[itemId]} />
              <Holders kind="HR" list={list.filter((r) => r.kind === 'HR')} />
              <Holders kind="SR" list={list.filter((r) => r.kind === 'SR')} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Holders({ kind, list }: { kind: ReserveKind; list: ReserveView[] }) {
  if (list.length === 0) return <span className="hidden md:block" />;
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
      <span className={cn('font-semibold', kind === 'HR' ? 'text-sand' : 'text-teal')}>
        {kind === 'HR' ? RESERVES.hrShort : RESERVES.srShort} <span className="tabular">{list.length}</span>
      </span>
      {list.map((r, i) => (
        <span key={r.userId} className="text-fg">
          {r.name}{' '}
          <span className="text-fg-3">
            (<span style={{ color: CLASS_COLORS[r.wowClass].onInk }}>{r.characterName}</span>)
          </span>
          {i < list.length - 1 ? ',' : ''}
        </span>
      ))}
    </span>
  );
}
