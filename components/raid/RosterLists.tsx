'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Chevron } from '@/components/shell/NavGroup';
import { Button, ClassAvatar, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import type { DetailRow } from '@/lib/raid-detail';
import { SAVE_FAILED } from '@/content/calendar';
import { ROSTER, UNANSWERED, UNKNOWN_MAIN } from '@/content/raid';
import { AnswerFor } from './AnswerFor';
import { useManageSignups } from './ManageSignups';

type Props = {
  raidId: string;
  noResponse: DetailRow[];
  absent: DetailRow[];
  /** Officers get "Answer for them" under each name once Manage sign-ups is on. */
  canAnswerFor: boolean;
  /** Officers get "Nudge in Discord" while the raid is open and posted. */
  officer: boolean;
  posted: boolean;
  open: boolean;
};

/** The two collapsible lists under the role groups (SYNC-SPEC §9.5): roster members who have not answered, and those who declined. Closed until opened. */
export function RosterLists({ raidId, noResponse, absent, canAnswerFor, officer, posted, open }: Props) {
  return (
    <div className="flex flex-col gap-3 pt-2">
      <Disclosure id="list-noresponse" title={ROSTER.noResponse} rows={noResponse} empty={UNANSWERED.empty} raidId={raidId} canAnswerFor={canAnswerFor} action={officer && open && noResponse.length > 0 ? <Nudge raidId={raidId} count={noResponse.length} posted={posted} /> : null} />
      <Disclosure id="list-absent" title={ROSTER.absent} rows={absent} empty={ROSTER.noAbsent} raidId={raidId} canAnswerFor={canAnswerFor} action={null} />
    </div>
  );
}

function Disclosure({ id, title, rows, empty, raidId, canAnswerFor, action }: { id: string; title: string; rows: DetailRow[]; empty: string; raidId: string; canAnswerFor: boolean; action: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-card border border-line bg-ink-850 px-4 py-3">
        <h3 className="flex min-h-11 items-center gap-2 text-sm font-semibold text-fg-2">
          {title}
          <span className="tabular font-normal text-fg-3">0</span>
        </h3>
        <p className="pb-1 text-sm text-fg-3">{empty}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-card border border-line bg-ink-850">
      <div className="flex flex-wrap items-center justify-between gap-2 pl-2 pr-4">
        <h3 className="m-0">
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded((v) => !v)}
            className="flex min-h-11 items-center gap-2.5 rounded-control px-2 text-sm font-semibold text-fg-2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <Chevron className={cn('text-fg-3 transition-transform duration-[120ms] motion-reduce:transition-none', expanded && 'rotate-180')} />
            {title}
            <span className="tabular font-normal text-fg-3">{rows.length}</span>
          </button>
        </h3>
        {action}
      </div>
      {expanded && (
        <ul id={id} className="grid gap-x-6 border-t border-line px-4 py-2 md:grid-cols-2">
          {rows.map((row) => (
            <CompactItem key={row.userId} raidId={raidId} row={row} canAnswerFor={canAnswerFor} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CompactItem({ raidId, row, canAnswerFor }: { raidId: string; row: DetailRow; canAnswerFor: boolean }) {
  const { on } = useManageSignups();
  const meta = row.wowClass ? [row.character, CLASS_COLORS[row.wowClass].label].filter(Boolean).join(' · ') : UNKNOWN_MAIN;
  return (
    <li className="flex min-h-11 items-start gap-3 py-2">
      <span className="pt-1">
        <ClassAvatar name={row.name} wowClass={row.wowClass} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="break-words text-sm font-semibold" style={{ color: row.wowClass ? CLASS_COLORS[row.wowClass].onInk : undefined }}>
          {row.name}
        </span>
        <span className="break-words text-small text-fg-3">{meta}</span>
        {row.response === 'absent' && row.reason && <span className="break-words text-small italic text-fg-2">“{row.reason}”</span>}
        {canAnswerFor && on && (
          <div className="pt-2">
            <AnswerFor raidId={raidId} userId={row.userId} name={row.name} current={row.response} />
          </div>
        )}
      </div>
    </li>
  );
}

/** "Nudge in Discord": mentions everyone still waiting, in the raid thread. */
function Nudge({ raidId, count, posted }: { raidId: string; count: number; posted: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function nudge() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/raids/${raidId}/remind`, { method: 'POST', credentials: 'same-origin' });
      const body = (await res.json().catch(() => null)) as { nudged?: number; error?: string } | null;
      if (!res.ok) {
        toast({ tone: 'stop', title: body?.error ?? SAVE_FAILED });
        return;
      }
      toast({ tone: 'ok', title: UNANSWERED.nudged(body?.nudged ?? count) });
      router.refresh();
    } catch {
      toast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={busy} disabled={!posted} title={posted ? UNANSWERED.nudgeHint : UNANSWERED.noThread} onClick={nudge}>
      {UNANSWERED.nudge}
    </Button>
  );
}
