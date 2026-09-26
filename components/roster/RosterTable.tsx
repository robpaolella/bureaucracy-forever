'use client';

import { useMemo, useState } from 'react';
import { Button, ClassAvatar, CONTROL, DataTable, EmptyState, FilterBar, MultiSelect, RankBadge, SegmentedControl, type Column } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, CLASSES, ROLE_LABELS, ROLES, type Role, type WowClass } from '@/lib/design/class-colors';
import {
  countActiveFilters,
  EMPTY_FILTERS,
  filterRoster,
  formatAttendance,
  groupRoster,
  RANK_ORDER,
  sortRoster,
  type GroupBy,
  type RosterFilters,
  type RosterRow,
  type RosterSortKey,
  type SortDir,
} from '@/lib/roster';
import { relativeDate } from '@/lib/time';
import { ROSTER_EMPTY, ROSTER_NO_MATCH } from '@/content/roster';
import { setDensity, useDensity } from './useDensity';

type Props = { rows: RosterRow[] };

const RANK_LABEL: Record<(typeof RANK_ORDER)[number], string> = { officer: 'Officer', raider: 'Raider', trial: 'Trial', social: 'Social' };
const GROUPS: { value: GroupBy; label: string }[] = [
  { value: 'flat', label: 'Flat' },
  { value: 'role', label: 'By role' },
  { value: 'class', label: 'By class' },
];

/**
 * docs/04 § Roster: filter bar, group-by control, sortable DataTable (rank then name by
 * default), density persisted per browser, and a two-line card list on phones. Nothing
 * here opens anything; it is a reference table.
 */
export function RosterTable({ rows }: Props) {
  const [filters, setFilters] = useState<RosterFilters>(EMPTY_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>('flat');
  const [sortKey, setSortKey] = useState<RosterSortKey>('rank');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const density = useDensity();
  const now = useMemo(() => new Date(), []);

  const shown = useMemo(() => sortRoster(filterRoster(rows, filters), sortKey, sortDir), [rows, filters, sortKey, sortDir]);
  const groups = useMemo(() => groupRoster(shown, groupBy, (c) => CLASS_COLORS[c].label, (r) => ROLE_LABELS[r]), [shown, groupBy]);
  const active = countActiveFilters(filters);

  const onSort = (key: string) => {
    const k = key as RosterSortKey;
    if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const columns: Column<RosterRow>[] = [
    {
      key: 'name',
      header: 'Character',
      sortable: true,
      render: (r) => (
        <span className="font-semibold" style={{ color: CLASS_COLORS[r.wowClass].onInk }}>
          {r.name}
        </span>
      ),
    },
    { key: 'class', header: 'Class', render: (r) => CLASS_COLORS[r.wowClass].label },
    { key: 'spec', header: 'Spec', render: (r) => <span className="text-fg-2">{r.spec}</span> },
    { key: 'role', header: 'Role', render: (r) => <span className="text-fg-2">{ROLE_LABELS[r.role]}</span> },
    { key: 'rank', header: 'Rank', sortable: true, render: (r) => <RankBadge rank={r.rank} /> },
    { key: 'attendance', header: 'Attendance', sortable: true, numeric: true, render: (r) => formatAttendance(r.attendance) },
    { key: 'joinedAt', header: 'Joined', sortable: true, align: 'right', render: (r) => <span className="text-fg-2">{relativeDate(new Date(r.joinedAt), now)}</span> },
  ];

  if (rows.length === 0) {
    return (
      <EmptyState title={ROSTER_EMPTY.title} className="min-h-[280px]">
        {ROSTER_EMPTY.body}
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar summary={`${shown.length} of ${rows.length} shown`} activeCount={active} onClear={() => setFilters(EMPTY_FILTERS)}>
        <input
          type="search"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          placeholder="Search characters"
          aria-label="Search characters"
          className={cn(CONTROL, 'h-11 px-3.5 md:w-[220px]')}
        />
        <MultiSelect label="Class" plural="classes" options={CLASSES.map((c) => ({ value: c, label: CLASS_COLORS[c].label }))} values={filters.classes} onChange={(classes: WowClass[]) => setFilters({ ...filters, classes })} className="md:w-[176px]" />
        <MultiSelect label="Role" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} values={filters.roles} onChange={(roles: Role[]) => setFilters({ ...filters, roles })} className="md:w-[176px]" />
        <select
          aria-label="Rank"
          value={filters.rank}
          onChange={(e) => setFilters({ ...filters, rank: e.target.value as RosterFilters['rank'] })}
          className={cn(CONTROL, 'h-11 px-3 md:w-[150px]', filters.rank && 'border-teal-dim')}
        >
          <option value="">Any rank</option>
          {RANK_ORDER.map((r) => (
            <option key={r} value={r}>
              {RANK_LABEL[r]}
            </option>
          ))}
        </select>
        <SegmentedControl
          label="Row density"
          size="sm"
          value={density}
          onChange={setDensity}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          className="hidden md:flex"
        />
      </FilterBar>

      <div className="flex items-center justify-between gap-4">
        <SegmentedControl label="Group by" value={groupBy} onChange={setGroupBy} options={GROUPS} />
      </div>

      {shown.length === 0 ? (
        <div role="status" className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-2">
          {ROSTER_NO_MATCH}
          <Button variant="secondary" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <DataTable
            caption="Guild roster"
            columns={columns}
            rows={shown}
            groups={groupBy === 'flat' ? undefined : groups}
            rowKey={(r) => r.id}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            density={density}
            className="hidden md:block"
          />
          <div className="flex flex-col gap-4 md:hidden">
            {groups.map((g) => (
              <section key={g.key} className="flex flex-col gap-2">
                {g.label && (
                  <h2 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-2">
                    {g.label} <span className="tabular font-normal text-fg-3">· {g.rows.length}</span>
                  </h2>
                )}
                <ul className="flex flex-col divide-y divide-line-faint overflow-hidden rounded-card border border-line bg-ink-900">
                  {g.rows.map((r) => (
                    <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                      <ClassAvatar name={r.name} wowClass={r.wowClass} size={28} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex items-center gap-2.5">
                          <span className="truncate text-[15px] font-semibold" style={{ color: CLASS_COLORS[r.wowClass].onInk }}>
                            {r.name}
                          </span>
                          <RankBadge rank={r.rank} />
                        </div>
                        <span className="truncate text-[13px] text-fg-3">
                          {CLASS_COLORS[r.wowClass].label} · {r.spec} · {ROLE_LABELS[r.role]}
                        </span>
                      </div>
                      <span className="tabular shrink-0 text-sm text-fg-2">{formatAttendance(r.attendance)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
