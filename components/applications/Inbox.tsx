'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { ClassAvatar, CONTROL, EmptyState, FilterBar, SegmentedControl, Tag } from '@/components/ui';
import { countActiveInboxFilters, DEFAULT_FILTERS, filterInbox, PATH_LABEL, sortInbox, type InboxFilters, type InboxItem } from '@/lib/applications-inbox';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import { relativeDate } from '@/lib/time';
import { INBOX, INBOX_EMPTY } from '@/content/applications';

type Props = {
  items: InboxItem[];
  /** The application open on the right, on wide screens. */
  selectedId: string | null;
  now: string;
  /** The right pane, rendered by the server for the selected application. */
  children: ReactNode;
};

/**
 * docs/04 § Applications inbox: a 380px list beside the open application. Filters are a
 * segmented Raider / Social / All, a status select and a search box, default Raider +
 * Pending. Rows are 72px with a sand unread dot; the selected row is teal-washed with a
 * 2px teal left edge, the one place a left accent is allowed. Picking a row selects it in
 * place: the row links to `?id=` on this page, so the right pane changes and the filters
 * stay put. On phones the pane is hidden, so the same click goes to the detail route.
 */
export function Inbox({ items, selectedId, now, children }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);

  /** Below the lg breakpoint there is no right pane; open the application as its own page instead. */
  function openRow(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    event.preventDefault();
    router.push(`/officers/applications/${id}`);
  }
  const at = useMemo(() => new Date(now), [now]);
  const shown = useMemo(() => sortInbox(filterInbox(items, filters)), [items, filters]);
  const pendingCount = items.filter((a) => a.status === 'pending').length;

  if (items.length === 0) {
    return (
      <EmptyState title={INBOX_EMPTY.title} className="min-h-[280px]">
        {INBOX_EMPTY.body}
      </EmptyState>
    );
  }
  // Caught up: applications exist but none is pending under the default view.
  const caughtUp = shown.length === 0 && pendingCount === 0 && filters.status === 'pending' && filters.search.trim() === '';

  return (
    <div className="flex flex-col gap-4">
      <FilterBar summary={INBOX.summary(shown.length, items.length)} activeCount={countActiveInboxFilters(filters)} onClear={() => setFilters(DEFAULT_FILTERS)}>
        <SegmentedControl
          label="Path"
          size="sm"
          value={filters.path}
          onChange={(path) => setFilters({ ...filters, path })}
          options={[
            { value: 'raider', label: INBOX.paths.raider },
            { value: 'social', label: INBOX.paths.social },
            { value: 'all', label: INBOX.paths.all },
          ]}
        />
        <select aria-label={INBOX.statusLabel} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value as InboxFilters['status'] })} className={cn(CONTROL, 'h-11 px-3 md:w-[150px]', filters.status !== DEFAULT_FILTERS.status && 'border-teal-dim')}>
          {(['pending', 'accepted', 'declined', 'all'] as const).map((s) => (
            <option key={s} value={s}>
              {INBOX.statuses[s]}
            </option>
          ))}
        </select>
        <input type="search" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder={INBOX.search} aria-label={INBOX.search} className={cn(CONTROL, 'h-11 px-3.5 md:w-[220px]')} />
      </FilterBar>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        {caughtUp ? (
          <EmptyState title={INBOX_EMPTY.title} className="min-h-[220px]">
            {INBOX_EMPTY.body}
          </EmptyState>
        ) : shown.length === 0 ? (
          <p role="status" className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-2">
            {INBOX.noMatch}
          </p>
        ) : (
          <ul className="divide-y divide-line-faint overflow-hidden rounded-card border border-line bg-ink-900" aria-label="Applications">
            {shown.map((a) => {
              const selected = a.id === selectedId;
              return (
                <li key={a.id} className="relative">
                  {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-teal" />}
                  <Link
                    href={`/officers/applications?id=${a.id}`}
                    scroll={false}
                    onClick={(event) => openRow(event, a.id)}
                    aria-current={selected ? 'true' : undefined}
                    className={cn('flex min-h-[72px] items-center gap-3 px-4 py-3 transition-colors duration-[120ms] hover:bg-ink-850', selected && 'bg-teal-wash')}
                  >
                    <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', a.unread ? 'bg-sand' : 'bg-transparent')} />
                    <ClassAvatar name={a.character} wowClass={a.wowClass} size={28} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold" style={{ color: a.wowClass ? CLASS_COLORS[a.wowClass].onInk : undefined }}>
                          {a.character}
                        </span>
                        {a.unread && <span className="sr-only">{INBOX.unread}</span>}
                      </span>
                      <span className="truncate text-[13px] text-fg-3">{a.wowClass ? `${CLASS_COLORS[a.wowClass].label} · ${a.spec}` : a.discordName}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Tag>{PATH_LABEL[a.path]}</Tag>
                      <time dateTime={a.createdAt} className="text-xs text-fg-3">
                        {relativeDate(new Date(a.createdAt), at)}
                      </time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <div className="hidden lg:block">{children}</div>
      </div>
    </div>
  );
}
