'use client';

import { useState } from 'react';
import { Button, DataTable, Modal, RankBadge, Toggle, type Column, type Rank, type SortDir } from '@/components/ui';
import { CLASS_COLORS, type WowClass } from '@/lib/design/class-colors';

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
