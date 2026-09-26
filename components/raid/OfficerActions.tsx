'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button, Select, Sheet, Toast, type ToastData } from '@/components/ui';
import { RESPONSES, type RaidResponse } from '@/lib/raids';
import { SAVE_FAILED } from '@/content/calendar';
import { OFFICER_ACTIONS, onBehalfToast } from '@/content/raid';

export type MemberOption = { id: string; label: string };

type Props = {
  raidId: string;
  members: MemberOption[];
  /** Editing, cancelling and answering for others stop once the raid is over or cancelled. */
  closed: boolean;
};

const RESPONSE_LABEL: Record<RaidResponse, string> = { accept: 'Accept', tentative: 'Tentative', absent: 'Absent' };

/**
 * The officer row at the top of the sign-up column (docs/04 § Raid detail): Edit raid,
 * Post to Discord, Cancel raid, and answering on a member's behalf, which the route
 * records as `setBy`. Edit / Cancel arrive with the schedule form and Post with the bot
 * sync, so they render disabled with a reason. On phones the row collapses into one
 * button that opens a sheet.
 */
export function OfficerActions({ raidId, members, closed }: Props) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const sheetId = useId();

  const content = (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" disabled title={OFFICER_ACTIONS.pending}>
          {OFFICER_ACTIONS.edit}
        </Button>
        <Button variant="secondary" size="sm" disabled title={OFFICER_ACTIONS.postPending}>
          {OFFICER_ACTIONS.post}
        </Button>
        <Button variant="danger" size="sm" disabled title={OFFICER_ACTIONS.pending}>
          {OFFICER_ACTIONS.cancel}
        </Button>
      </div>
      {!closed && <OnBehalfForm raidId={raidId} members={members} onToast={setToast} onDone={() => setOpen(false)} />}
    </div>
  );

  return (
    <section aria-label={OFFICER_ACTIONS.heading} className="rounded-card border border-line bg-ink-850 p-4">
      <div className="hidden md:block">{content}</div>
      <div className="md:hidden">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-controls={sheetId} aria-expanded={open} className="w-full">
          {OFFICER_ACTIONS.heading}
        </Button>
        <Sheet id={sheetId} open={open} onClose={() => setOpen(false)} title={OFFICER_ACTIONS.heading}>
          {content}
        </Sheet>
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}

function OnBehalfForm({ raidId, members, onToast, onDone }: { raidId: string; members: MemberOption[]; onToast: (t: ToastData) => void; onDone: () => void }) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [response, setResponse] = useState<RaidResponse | ''>('accept');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!userId || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/raids/${raidId}/signup`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: response || null, forUserId: userId }),
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(String(res.status));
      const name = members.find((m) => m.id === userId)?.label ?? 'Member';
      onToast({ tone: 'ok', title: onBehalfToast(name, response ? RESPONSE_LABEL[response].toLowerCase() : null) });
      router.refresh();
      onDone();
    } catch {
      onToast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 md:flex-row md:items-end" aria-label={OFFICER_ACTIONS.onBehalf}>
      <Select label={OFFICER_ACTIONS.member} options={[{ value: '', label: OFFICER_ACTIONS.choose }, ...members.map((m) => ({ value: m.id, label: m.label }))]} value={userId} onChange={(e) => setUserId(e.target.value)} className="md:w-[220px]" />
      <Select
        label={OFFICER_ACTIONS.response}
        options={[...RESPONSES.map((r) => ({ value: r, label: RESPONSE_LABEL[r] })), { value: '', label: OFFICER_ACTIONS.clear }]}
        value={response}
        onChange={(e) => setResponse(e.target.value as RaidResponse | '')}
        className="md:w-[200px]"
      />
      <Button type="submit" variant="secondary" size="md" loading={saving} disabled={!userId}>
        {OFFICER_ACTIONS.apply}
      </Button>
    </form>
  );
}
