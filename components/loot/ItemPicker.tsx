'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CONTROL, Field } from '@/components/ui/Field';
import { RESERVES } from '@/content/reserves';
import { cn } from '@/lib/cn';
import { itemQuality } from '@/lib/design/item-quality';
import { filterItems, type SearchItem } from '@/lib/item-search';
import { ItemLabel } from './ItemName';

type Props = {
  label: string;
  items: SearchItem[];
  value: number | null;
  onChange: (value: number | null) => void;
  counts: Map<number, { HR: number; SR: number }>;
  unavailable: (id: number) => string | null;
  ownPick: (id: number) => string;
};

/** Editable combobox: focus stays in the input; only an explicit choice edits the draft. */
export function ItemPicker({ label, items, value, onChange, counts, unavailable, ownPick }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<number | null | undefined>(undefined);
  const rows = filterItems(items, query);
  // None stays available, including when a search has no matching items.
  const choices = [null, ...rows.map(({ item }) => item.id)];
  const activeId = active !== undefined && choices.includes(active) ? `${id}-option-${active ?? 'none'}` : undefined;
  const selected = items.find(({ item }) => item.id === value)?.item.name ?? RESERVES.none;

  useEffect(() => {
    if (open && activeId) list.current?.querySelector(`[id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeId]);

  function close() { setOpen(false); setQuery(''); setActive(undefined); }
  function choose(next: number | null) {
    if (next !== null && unavailable(next)) return;
    onChange(next);
    close();
    input.current?.focus();
  }

  return (
    <div className="min-w-0" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) close(); }}>
      <Field label={label} id={id}>
        <input
          ref={input}
          className={cn(CONTROL, 'h-[46px] px-3.5 placeholder:text-fg-2')}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-activedescendant={open ? activeId : undefined}
          autoComplete="off"
          placeholder={RESERVES.search}
          value={open ? query : selected}
          onClick={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setActive(undefined); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close(); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const index = open ? choices.findIndex((choice) => choice === active) : -1;
              const next = index === -1 ? (e.key === 'ArrowDown' ? 0 : choices.length - 1) : (index + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
              setOpen(true);
              setActive(choices[next]);
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              if (open && activeId) choose(active!);
              else setOpen(true);
            }
          }}
        />
      </Field>
      {open && (
        <div className="mt-2 rounded-control border border-line-strong bg-ink-800">
          <div ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto overscroll-contain p-1">
            <button type="button" role="option" id={`${id}-option-none`} aria-selected={value === null} tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(null)} className={cn('min-h-11 w-full rounded-control px-2 text-left text-sm hover:bg-ink-700', active === null && 'bg-teal-wash outline outline-1 outline-teal')}>
              {RESERVES.none}
            </button>
            {rows.map(({ item, bosses, bossLabel }) => {
              const count = counts.get(item.id) ?? { HR: 0, SR: 0 };
              const reason = unavailable(item.id);
              const own = ownPick(item.id);
              return (
                <button
                  key={item.id} id={`${id}-option-${item.id}`} type="button" role="option" tabIndex={-1}
                  aria-selected={value === item.id} aria-disabled={Boolean(reason)}
                  aria-label={[item.name, itemQuality(item.quality).label, bosses.join(', '), RESERVES.pickerCounts(count.HR, count.SR), own, reason].filter(Boolean).join(' — ')}
                  title={`${item.name} — ${bosses.join(', ')}`}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => choose(item.id)}
                  className={cn('grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 rounded-control px-2 py-2 text-left text-sm', reason ? 'cursor-not-allowed' : 'hover:bg-ink-700', active === item.id && 'bg-teal-wash outline outline-1 outline-teal', value === item.id && 'bg-ink-700')}
                >
                  <ItemLabel item={item} className="[&>span]:whitespace-normal [&>span]:break-words" />
                  <span className="row-span-2 self-center text-right text-xs tabular text-fg-2"><span className="block">HR {count.HR}</span><span className="block">SR {count.SR}</span></span>
                  <span className="flex flex-wrap justify-end gap-x-2 text-right text-xs text-fg-2"><span>{own}</span><span>{bossLabel}</span></span>
                  {reason && <span className="col-span-2 text-xs text-warn">{reason}</span>}
                </button>
              );
            })}
          </div>
          <p role="status" className="border-t border-line-strong px-3 py-2 text-xs text-fg-2">{rows.length ? RESERVES.resultCount(rows.length) : RESERVES.noMatches}</p>
        </div>
      )}
    </div>
  );
}
