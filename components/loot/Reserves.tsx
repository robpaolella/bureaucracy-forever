'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { LocalTime } from '@/components/time/LocalTime';
import { Button, Field, useToast } from '@/components/ui';
import { CONTROL } from '@/components/ui/Field';
import { RESERVES } from '@/content/reserves';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import { itemSources, sourceLabel } from '@/lib/item-search';
import type { LootTableView, ReserveTargetRow, ReserveView } from '@/lib/loot-data';
import { reserveHolders, type ReserveKind } from '@/lib/loot-rules';
import { RESERVES_PARAM } from '@/lib/raids';
import { ItemName } from './ItemName';
import { ReserverCount, type OwnMark } from './ReservePicker';
import { ReserveWindow } from './ReserveWindow';

/** A member whose reserves the viewer may set: themselves, or anyone eligible for an officer. */
export type ReserveTarget = ReserveTargetRow;

type Props = {
  raid: { id: string; name: string; startsAt: string };
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
  /** Open the window on the viewer's own reserves at load (the bot's reserves link). */
  openOnLoad?: boolean;
};

/**
 * Raid detail § Loot reserves: the saved picks with "Pick reserves" or "Change reserves", which
 * open the reserves window until the lock (officers after it too, for anyone eligible), and
 * everyone's reserves, visible to all members.
 */
export function Reserves({ raid, table, reserves, lockAt, locked, cancelled, officer, targets, reason, openOnLoad = false }: Props) {
  const toast = useToast();
  const [targetId, setTargetId] = useState(targets.find((t) => t.self)?.userId ?? targets[0]?.userId);
  const [open, setOpen] = useState(openOnLoad);
  const target = targets.find((t) => t.userId === targetId) ?? targets[0];
  const canChange = !cancelled && target && (!locked || officer);
  const chooser = officer && targets.length > 1;
  // Drop the link's query once it has opened the window, so a reload or Back doesn't reopen it.
  useEffect(() => {
    if (!openOnLoad) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(RESERVES_PARAM);
    window.history.replaceState(null, '', url);
  }, [openOnLoad]);
  const holders = useMemo(() => reserveHolders(reserves), [reserves]);
  const sources = useMemo(() => itemSources(table.bosses), [table.bosses]);
  const mark = target && { userId: target.userId, label: target.self ? RESERVES.yours : RESERVES.editing };
  const picks = target && (['HR', 'SR'] as const).map((kind) => ({ kind, itemId: kind === 'HR' ? target.current.hr : target.current.sr }));
  const character = target?.characters.find((c) => c.id === target.current.characterId);
  const button = (label: string, primary: boolean) => canChange && (
    <Button variant={primary ? 'primary' : 'secondary'} size={primary ? 'md' : 'sm'} onClick={() => setOpen(true)}>{label}</Button>
  );
  return (
    <section id="loot-reserves" className="flex scroll-mt-24 flex-col gap-5 rounded-card border border-line bg-ink-850 p-4 md:p-5" aria-labelledby="reserves-heading">
      <h2 id="reserves-heading" className="font-display text-2xl font-medium">
        {RESERVES.heading}
      </h2>
      <p className="max-w-[720px] text-sm text-fg-2">
        {RESERVES.lede} <LocalTime startsAt={lockAt} durationMin={0} className="whitespace-nowrap" />.
      </p>
      {cancelled ? (
        <p className="text-sm text-stop">{RESERVES.cancelled}</p>
      ) : locked ? (
        <p className="text-sm text-warn">{officer ? RESERVES.lockedOfficer : RESERVES.locked}</p>
      ) : null}
      {cancelled ? null : !target || !picks ? (
        reason && <p className="text-sm text-fg-3">{reason}</p>
      ) : (
        <div className="flex flex-col gap-3 rounded-card border border-line-faint bg-ink-900 p-4">
          {chooser ? (
            <div className="flex flex-wrap items-end gap-4">
              <Field label={RESERVES.forWhom}>
                <select className={cn(CONTROL, 'h-[46px] w-auto min-w-[150px] px-3')} value={target.userId} onChange={(e) => setTargetId(e.target.value)}>
                  {targets.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.self ? RESERVES.you(t.name) : t.name}
                    </option>
                  ))}
                </select>
              </Field>
              {button(RESERVES.change, false)}
            </div>
          ) : picks.some((p) => p.itemId !== null) ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">
                {[RESERVES.yourReserves, character?.name, character && CLASS_COLORS[character.wowClass].label].filter(Boolean).join(' · ')}
              </span>
              {button(RESERVES.change, false)}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-fg">{RESERVES.none}</p>
              {button(RESERVES.pick, true)}
            </div>
          )}
          {(chooser || picks.some((p) => p.itemId !== null)) && (
            <div className="flex flex-col gap-1.5">
              {picks.map(({ kind, itemId }) => <PickRow key={kind} kind={kind} item={itemId === null ? undefined : table.items[itemId]} from={itemId === null ? [] : sources.get(itemId) ?? []} />)}
            </div>
          )}
        </div>
      )}
      <ReserveList table={table} holders={holders} mark={mark} />
      {canChange && <ReserveWindow open={open} onClose={() => setOpen(false)} raid={raid} data={{ table, reserves, targets, lockAt }} targetId={target.userId} notify={toast} />}
    </section>
  );
}

type Holders = ReturnType<typeof reserveHolders<ReserveView>>;

/** One saved pick in the section: kind, the item with its tooltip, and where it drops. */
function PickRow({ kind, item, from }: { kind: ReserveKind; item?: LootTableView['items'][number]; from: string[] }) {
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
      <span className={cn('w-7 shrink-0 font-semibold', kind === 'HR' ? 'text-sand' : 'text-teal')}>
        {kind}<span className="sr-only"> ({kind === 'HR' ? RESERVES.hr : RESERVES.sr})</span>
      </span>
      {item ? (
        <>
          <ItemName item={item} className="text-sm" />
          <span className="text-[13px] text-fg-2">{sourceLabel(from)}</span>
        </>
      ) : (
        <span className="text-fg-3">{RESERVES.noPick}</span>
      )}
    </div>
  );
}

/** Everyone's reserves by item, hard reserves first; each count opens the names. */
export function ReserveList({ table, holders, mark }: { table: LootTableView; holders: Holders; mark?: OwnMark }) {
  const rows = [...holders.entries()]
    .filter(([id]) => table.items[id])
    .sort(([a, ha], [b, hb]) => hb.HR.length - ha.HR.length || table.items[a].name.localeCompare(table.items[b].name));
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 ? (
        <>
          <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{RESERVES.listHeading}</h3>
          <p className="text-sm text-fg-3">{RESERVES.listEmpty}</p>
        </>
      ) : (
        <>
        <h3 className="m-0">
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
            className="inline-flex min-h-11 items-center gap-1.5 self-start text-left text-sm font-semibold text-teal hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            {open ? RESERVES.hideList : RESERVES.showList(rows.length)}
          </button>
        </h3>
        <ul id={id} hidden={!open} className="divide-y divide-line-faint rounded-card border border-line-faint">
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
        </>
      )}
    </div>
  );
}
