'use client';

import { useState } from 'react';
import { Button, ClassAvatar, CONTROL, DataTable, FilterBar, Modal, MultiSelect, ProgressTrack, RankBadge, SegmentedControl, Toggle, type Column, type Rank, type SortDir } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, CLASSES, ROLE_LABELS, ROLES, type Role, type WowClass } from '@/lib/design/class-colors';

export function ToggleDemo() {
  const [on, setOn] = useState(true);
  return <Toggle label="Sync sign-ups to Discord" checked={on} onChange={setOn} />;
}

export function LoadingButtonDemo() {
  return <Button loading>Saving</Button>;
}

export function ModalDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
        Open live modal
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Decline Subclause?"
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep pending
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Decline
            </Button>
          </>
        }
      >
        They will get a note in Discord. Your officer comments stay private.
      </Modal>
    </>
  );
}

type Row = { name: string; cls: WowClass; role: string; rank: Rank; attendance: number };

const ROWS: Row[] = [
  { name: 'Ledgerline', cls: 'warrior', role: 'Tank', rank: 'officer', attendance: 98 },
  { name: 'Redtape', cls: 'priest', role: 'Healer', rank: 'raider', attendance: 94 },
  { name: 'Subclause', cls: 'warlock', role: 'Ranged DPS', rank: 'trial', attendance: 76 },
];

const COLUMNS: Column<Row>[] = [
  {
    key: 'name',
    header: 'Character',
    sortable: true,
    render: (r) => (
      <span className="font-semibold" style={{ color: CLASS_COLORS[r.cls].onInk }}>
        {r.name}
      </span>
    ),
  },
  { key: 'cls', header: 'Class', sortable: true, render: (r) => <span className="text-fg-2">{CLASS_COLORS[r.cls].label}</span> },
  { key: 'role', header: 'Role', render: (r) => <span className="text-fg-2">{r.role}</span> },
  { key: 'rank', header: 'Rank', render: (r) => <RankBadge rank={r.rank} /> },
  { key: 'attendance', header: 'Attendance', numeric: true, sortable: true, render: (r) => `${r.attendance}%` },
];

export function TableDemo() {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = [...ROWS].sort((a, b) => {
    const av = a[sortKey as keyof Row];
    const bv = b[sortKey as keyof Row];
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <DataTable
      caption="Roster sample"
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.name}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={(key) => {
        if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else {
          setSortKey(key);
          setSortDir('asc');
        }
      }}
    />
  );
}

export function RosterPrimitivesDemo() {
  const [group, setGroup] = useState<'flat' | 'role' | 'class'>('flat');
  const [response, setResponse] = useState<'accept' | 'tentative' | 'absent' | null>('accept');
  const [classes, setClasses] = useState<WowClass[]>([]);
  const [roles, setRoles] = useState<Role[]>(['healer']);
  const active = classes.length + roles.length;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6">
        <SegmentedControl
          label="Group roster by"
          value={group}
          onChange={setGroup}
          options={[
            { value: 'flat', label: 'Flat' },
            { value: 'role', label: 'By role' },
            { value: 'class', label: 'By class' },
          ]}
        />
        <SegmentedControl
          label="Your response"
          value={response}
          onChange={setResponse}
          options={[
            { value: 'accept', label: 'Accept', tone: 'ok' },
            { value: 'tentative', label: 'Tentative', tone: 'warn' },
            { value: 'absent', label: 'Absent', tone: 'stop' },
          ]}
        />
        <SegmentedControl label="Density" size="sm" value="comfortable" onChange={() => {}} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
      </div>
      <FilterBar
        summary={`${41 - active * 6} of 41 shown`}
        activeCount={active}
        onClear={() => {
          setClasses([]);
          setRoles([]);
        }}
      >
        <input className={cn(CONTROL, 'h-11 px-3.5 md:w-[220px]')} placeholder="Search characters" aria-label="Search characters" />
        <MultiSelect label="Class" plural="classes" options={CLASSES.map((c) => ({ value: c, label: CLASS_COLORS[c].label }))} values={classes} onChange={setClasses} className="md:w-[180px]" />
        <MultiSelect label="Role" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} values={roles} onChange={setRoles} className="md:w-[180px]" />
      </FilterBar>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          {(
            [
              ['Ledgerline', 'warrior'],
              ['Redtape', 'priest'],
              ['Subclause', 'warlock'],
              ['Nobody yet', null],
            ] as const
          ).map(([name, cls]) => (
            <div key={name} className="flex items-center gap-3 text-sm">
              <ClassAvatar name={name} wowClass={cls} />
              <span className="font-semibold" style={{ color: cls ? CLASS_COLORS[cls].onInk : undefined }}>
                {name}
              </span>
              <ClassAvatar name={name} wowClass={cls} size={32} className="ml-auto" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3 text-sm">
          {(
            [
              ['Tanks', 2, 2],
              ['Healers', 6, 8],
              ['Melee', 11, 9],
              ['Ranged', 0, 11],
            ] as const
          ).map(([label, value, max]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <div className="flex justify-between">
                <span className="text-fg-2">{label}</span>
                <span className="tabular">
                  {value} <span className="text-fg-3">/ {max}</span>
                </span>
              </div>
              <ProgressTrack value={value} max={max} label={label} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
