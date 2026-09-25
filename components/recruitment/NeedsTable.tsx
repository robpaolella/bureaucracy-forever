'use client';

import { DataTable, StatusPill, type Column } from '@/components/ui';
import { CLASS_NEEDS, NEED_LABEL, type ClassNeed } from '@/content/recruitment';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';

const TONE = { high: 'ok', medium: 'warn', closed: 'closed' } as const;

const COLUMNS: Column<ClassNeed>[] = [
  {
    key: 'class',
    header: 'Class',
    className: 'w-[26%]',
    render: (r) => (
      <span className="font-semibold" style={{ color: CLASS_COLORS[r.wowClass].onInk }}>
        {CLASS_COLORS[r.wowClass].label}
      </span>
    ),
  },
  { key: 'spec', header: 'Spec', className: 'w-[24%]', render: (r) => <span className="text-fg-2">{r.specs.join(' · ')}</span> },
  { key: 'role', header: 'Role', className: 'w-[24%]', render: (r) => <span className="text-fg-2">{r.roles.map((x) => ROLE_LABELS[x]).join(' · ')}</span> },
  {
    key: 'status',
    header: 'Status',
    align: 'right',
    render: (r) => <StatusPill tone={TONE[r.status]}>{NEED_LABEL[r.status]}</StatusPill>,
  },
];

const rowKey = (r: ClassNeed) => `${r.wowClass}-${r.specs.join('-')}`;

/**
 * Class / spec / role / status. A table from md up; on mobile one card per row with class
 * and status on the first line, spec and role on the second (docs/04 § Recruitment).
 */
export function NeedsTable() {
  return (
    <>
      <div className="hidden md:block">
        <DataTable caption="Open needs by class and role" columns={COLUMNS} rows={CLASS_NEEDS} rowKey={rowKey} className="text-[15px]" />
      </div>
      <ul className="flex flex-col gap-2 md:hidden" aria-label="Open needs by class and role">
        {CLASS_NEEDS.map((r) => (
          <li key={rowKey(r)} className="flex flex-col gap-1.5 rounded-card border border-line bg-ink-850 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold" style={{ color: CLASS_COLORS[r.wowClass].onInk }}>
                {CLASS_COLORS[r.wowClass].label}
              </span>
              <StatusPill tone={TONE[r.status]}>{NEED_LABEL[r.status]}</StatusPill>
            </div>
            <span className="text-[13px] text-fg-3">
              {r.specs.join(' · ')} · {r.roles.map((x) => ROLE_LABELS[x]).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
