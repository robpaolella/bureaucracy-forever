'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SortDir = 'asc' | 'desc';

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Right-aligns and sets tabular numerals. */
  numeric?: boolean;
  align?: 'left' | 'right';
  sortable?: boolean;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sortKey?: string;
  sortDir?: SortDir;
  /** Sorting is controlled: the table reports the clicked key, the owner re-orders rows. */
  onSort?: (key: string) => void;
  density?: 'comfortable' | 'compact';
  /** Visually hidden caption for screen readers. */
  caption?: string;
  className?: string;
};

/**
 * 44px rows, zebra on even rows, hover ink-850. The page scrolls, the table does not,
 * so 40+ rows never become a scroll trap. Mobile card layout lives with the page (docs/04).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  sortKey,
  sortDir = 'asc',
  onSort,
  density = 'comfortable',
  caption,
  className,
}: DataTableProps<T>) {
  const pad = density === 'compact' ? 'py-2' : 'py-[13px]';
  const isRight = (c: Column<T>) => c.align === 'right' || c.numeric;

  return (
    <div className={cn('overflow-x-auto rounded-card border border-line bg-ink-900', className)}>
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-ink-850">
            {columns.map((c) => {
              const active = sortKey === c.key;
              const sortable = Boolean(c.sortable && onSort);
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined}
                  className={cn(
                    'border-b border-line px-5 py-3 text-label font-semibold uppercase tracking-[0.12em] text-fg-3',
                    isRight(c) ? 'text-right' : 'text-left',
                  )}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(c.key)}
                      className="-my-3 inline-flex min-h-11 items-center gap-1.5 uppercase tracking-[0.12em]"
                    >
                      {c.header}
                      {active && (
                        <span aria-hidden className="text-teal">
                          {sortDir === 'desc' ? '↓' : '↑'}
                        </span>
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child>td]:border-b-0">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition-colors duration-[120ms] even:bg-ink-850 hover:bg-ink-850">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'border-b border-line-faint px-5',
                    pad,
                    isRight(c) && 'text-right',
                    c.numeric && 'tabular',
                    c.className,
                  )}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
