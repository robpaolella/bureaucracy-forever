'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Button, Sheet } from '@/components/ui';
import { CONTROL } from '@/components/ui/Field';
import { RESERVES } from '@/content/reserves';
import { cn } from '@/lib/cn';
import { itemQuality } from '@/lib/design/item-quality';
import { filterItems, itemSources, sourceDetails, sourceLabel } from '@/lib/item-search';
import type { LootTableView } from '@/lib/loot-data';
import type { ReserveKind } from '@/lib/loot-rules';
import { ItemLabel, ItemName } from './ItemName';

type Props = {
  table: LootTableView;
  counts: Map<number, { HR: number; SR: number }>;
  blocked: Set<number>;
  hr: number | null;
  sr: number | null;
  /** Null when choosing for yourself. */
  forName: string | null;
  onChange: (kind: ReserveKind, id: number | null) => void;
};

/** Selection previews an item; only Choose/Remove changes a draft reserve. */
export function ReservePicker({ table, counts, blocked, hr, sr, forName, onChange }: Props) {
  const [slot, setSlot] = useState<ReserveKind>('HR');
  const [query, setQuery] = useState('');
  const items = useMemo(() => filterItems(Object.values(table.items), ''), [table.items]);
  const sources = useMemo(() => itemSources(table.bosses), [table.bosses]);
  const filtered = useMemo(() => filterItems(items, query), [items, query]);
  const [previewId, setPreviewId] = useState<number | null>(items[0]?.id ?? null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const id = useId();
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const slotButtons = useRef<Partial<Record<ReserveKind, HTMLButtonElement | null>>>({});
  const preview = filtered.find((item) => item.id === previewId);
  const picked = (itemId: number) => hr === itemId ? 'HR' : sr === itemId ? 'SR' : null;
  const reason = (itemId: number) => blocked.has(itemId) ? RESERVES.blocked
    : (slot === 'HR' ? sr : hr) === itemId ? RESERVES.otherSlot(slot === 'HR' ? 'SR' : 'HR') : null;

  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)');
    const resize = () => { if (media.matches) setSheet(false); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, []);

  function select(itemId: number) {
    setPreviewId(itemId);
    setActiveId(itemId);
    if (!window.matchMedia('(min-width: 900px)').matches) setSheet(true);
  }

  function navigate(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      // Never let Enter in the combobox submit the surrounding reserve form.
      e.preventDefault();
      if (activeId !== null) select(activeId);
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(e.key) || !filtered.length) return;
    e.preventDefault();
    const index = filtered.findIndex((item) => item.id === activeId);
    const nextIndex = index < 0 ? (e.key === 'ArrowDown' ? 0 : filtered.length - 1)
      : Math.max(0, Math.min(filtered.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)));
    const next = filtered[nextIndex];
    setActiveId(next.id);
    list.current?.querySelector(`[data-item-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function choose(itemId: number | null) {
    if (itemId !== null && reason(itemId)) return;
    onChange(slot, itemId);
    if (itemId !== null && slot === 'HR' && sr === null) setSlot('SR');
    setSheet(false);
    // Keep the next keyboard action predictable even when Choose becomes Remove.
    search.current?.focus({ preventScroll: true });
  }

  const details = preview ? (
    <ItemDetails key={`${preview.id}-${slot}`} item={preview} sources={sources.get(preview.id) ?? []}
      slot={slot} picked={picked(preview.id) === slot} reason={reason(preview.id)} forName={forName}
      onChoose={() => choose(preview.id)} onRemove={() => choose(null)} />
  ) : <p className="text-sm text-fg-2">{RESERVES.detailsEmpty}</p>;

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div role="radiogroup" aria-label={RESERVES.choosingSlot} className="grid grid-cols-2 gap-2.5">
        {(['HR', 'SR'] as const).map((kind) => {
          const itemId = kind === 'HR' ? hr : sr;
          const item = itemId === null ? null : table.items[itemId];
          return (
            <button key={kind} type="button" role="radio" aria-checked={slot === kind} tabIndex={slot === kind ? 0 : -1}
              ref={(button) => { slotButtons.current[kind] = button; }}
              onClick={() => setSlot(kind)}
              onKeyDown={(e) => {
                if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
                e.preventDefault();
                const next = kind === 'HR' ? 'SR' : 'HR';
                setSlot(next);
                slotButtons.current[next]?.focus();
              }}
              className={cn('flex min-h-[86px] min-w-0 flex-col gap-1.5 rounded-control border px-3 py-2.5 text-left',
                slot === kind ? 'border-teal bg-teal-wash' : 'border-line-strong bg-ink-900 hover:bg-ink-800')}
            >
              <span className="flex w-full flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.08em] text-fg-2">
                  <span className={kind === 'HR' ? 'text-sand' : 'text-teal'}>{kind}</span> · {kind === 'HR' ? RESERVES.hr : RESERVES.sr}
                </span>
                {slot === kind && <span className="text-label font-semibold uppercase tracking-[0.12em] text-teal">{RESERVES.choosing}</span>}
              </span>
              {item ? <ItemLabel item={item} size="medium" className="text-[13px] sm:text-sm [&>img]:h-7 [&>img]:w-7 sm:[&>img]:h-9 sm:[&>img]:w-9 [&>span]:whitespace-normal [&>span]:[overflow-wrap:anywhere]" />
                : <span className="flex min-h-9 items-center text-sm text-fg-muted">{RESERVES.notPicked}</span>}
            </button>
          );
        })}
      </div>
      <div className="relative">
        <svg className="pointer-events-none absolute left-3.5 top-[15px] text-fg-3" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="7" cy="7" r="5" /><path d="m11 11 3.5 3.5" />
        </svg>
        <input ref={search} type="search" role="combobox" aria-label={RESERVES.search} placeholder={RESERVES.search}
          aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={activeId === null ? undefined : `${id}-item-${activeId}`}
          autoComplete="off" value={query} onKeyDown={navigate}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveId(null);
            setPreviewId(filterItems(items, e.target.value)[0]?.id ?? null);
          }} className={cn(CONTROL, 'h-[46px] w-full pl-10 pr-3 text-sm')} />
      </div>
      <div className="grid min-w-0 gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 self-start rounded-control border border-line-strong bg-ink-900">
          <div ref={list} id={`${id}-list`} role="listbox" aria-label={RESERVES.items} className="max-h-[430px] overflow-y-auto">
            {filtered.map((item) => {
              const from = sources.get(item.id) ?? [];
              const count = counts.get(item.id) ?? { HR: 0, SR: 0 };
              const own = picked(item.id);
              const unavailable = reason(item.id);
              const label = [item.name, itemQuality(item.quality).label, from.join(', '), `HR ${count.HR}, SR ${count.SR}`, own && RESERVES.picked(own), unavailable].filter(Boolean).join(' — ');
              return (
                <button key={item.id} id={`${id}-item-${item.id}`} data-item-id={item.id} type="button" role="option"
                  aria-label={label} aria-selected={preview?.id === item.id} tabIndex={-1} onClick={() => select(item.id)}
                  className={cn('flex min-h-14 w-full items-center justify-between gap-2 border-b border-line-faint px-2.5 py-1.5 text-left text-sm hover:bg-ink-800',
                    (activeId ?? preview?.id) === item.id && 'bg-ink-700 ring-1 ring-inset ring-teal')}
                >
                  <ItemName item={item} size="medium" followPointer previewOnly description={
                    <span className="mt-1 flex flex-wrap gap-x-2 text-xs font-normal text-fg-2">
                      <span>{sourceLabel(from)}</span>
                      {own && <span className={own === 'HR' ? 'text-sand' : 'text-teal'}>{RESERVES.picked(own)}</span>}
                      {unavailable && <span className={blocked.has(item.id) ? 'text-stop' : 'text-warn'}>{unavailable}</span>}
                    </span>
                  } />
                  <span aria-hidden="true" className="flex shrink-0 flex-col text-right text-xs tabular-nums">
                    {(['HR', 'SR'] as const).map((kind) => <span key={kind} className={count[kind] ? 'text-fg' : 'text-fg-muted'}>
                      <span className={count[kind] ? kind === 'HR' ? 'text-sand' : 'text-teal' : undefined}>{kind}</span> {count[kind]}
                    </span>)}
                  </span>
                </button>
              );
            })}
          </div>
          {!filtered.length && <p className="p-3 text-sm text-fg-2">{RESERVES.noMatches}</p>}
          <p role="status" className="border-t border-line-strong px-3 py-2 text-xs text-fg-2">{RESERVES.itemCount(filtered.length, items.length)}</p>
        </div>
        <aside aria-label={RESERVES.details} className="hidden min-w-0 self-start rounded-card border border-line bg-ink-850 p-3.5 min-[900px]:block">{!sheet && details}</aside>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title={RESERVES.details}>{sheet && details}</Sheet>
    </div>
  );
}

function ItemDetails({ item, sources, slot, picked, reason, forName, onChoose, onRemove }: {
  item: LootTableView['items'][number]; sources: string[]; slot: ReserveKind; picked: boolean; reason: string | null;
  forName: string | null; onChoose: () => void; onRemove: () => void;
}) {
  const id = useId();
  return <div className="flex min-w-0 flex-col gap-3.5">
    <div className="flex min-w-0 flex-col gap-1">
      <ItemName item={item} size="medium" followPointer className="text-sm" />
      <p className="pl-11 text-[13px] text-fg-2">{sourceDetails(sources)}</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      {picked ? <>
        <p className={cn('text-sm', slot === 'HR' ? 'text-sand' : 'text-teal')}>{RESERVES.pickedDetails(slot, forName)}</p>
        <Button variant="ghost" onClick={onRemove}>{RESERVES.remove}</Button>
      </> : reason ? <>
        <span className="group relative">
          <Button aria-disabled="true" aria-describedby={id} className="cursor-not-allowed bg-ink-700 text-fg-3 hover:brightness-100" onClick={() => {}}>{RESERVES.choose(slot)}</Button>
          <span role="tooltip" className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden w-64 max-w-[calc(100vw-72px)] rounded-control border border-line-strong bg-ink-800 p-3 text-sm text-fg shadow-pop group-hover:block group-focus-within:block">{RESERVES.ineligible} {reason}.</span>
        </span>
        <p id={id} className={cn('text-sm', reason === RESERVES.blocked ? 'text-stop' : 'text-warn')}><span className="sr-only">{RESERVES.ineligible} </span>{reason}</p>
      </> : <Button onClick={onChoose}>{RESERVES.choose(slot)}</Button>}
    </div>
  </div>;
}
