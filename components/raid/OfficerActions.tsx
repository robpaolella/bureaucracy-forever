'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button, ButtonLink, Field, Modal, Select, Sheet, Textarea, useToast, type ToastData } from '@/components/ui';
import { raidToInput, RESPONSES, type RaidCard, type RaidInput, type RaidResponse } from '@/lib/raids';
import { SAVE_FAILED } from '@/content/calendar';
import { OFFICER_ACTIONS, onBehalfToast, RAID_TOASTS } from '@/content/raid';
import { RaidForm } from './RaidForm';

export type MemberOption = { id: string; label: string };

type Props = {
  raid: RaidCard;
  members: MemberOption[];
  /** A finished raid is history: nothing here changes it. */
  past: boolean;
  /** The #raid-signups thread, once the bot has posted the raid. */
  threadUrl: string | null;
};

const RESPONSE_LABEL: Record<RaidResponse, string> = { accept: 'Accept', tentative: 'Tentative', absent: 'Absent' };

async function patchRaid(id: string, body: unknown): Promise<Response> {
  return fetch(`/api/raids/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
}

/** The route's own message for a 400 or 409 (a finished raid, a cancelled one); the generic line otherwise. */
async function failureMessage(res: Response): Promise<string> {
  if (res.status !== 400 && res.status !== 409) return SAVE_FAILED;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? SAVE_FAILED;
}

/**
 * The officer row at the top of the sign-up column (docs/04 § Raid detail): Edit raid,
 * the link to the Discord thread once the bot has posted it, Cancel raid with a reason
 * (SYNC-SPEC §9.5), and answering for someone who has no row yet, which the route records
 * as `setBy`. Edit opens the schedule form prefilled; Cancel asks first and can be undone
 * with Restore. On phones the row collapses into one button that opens a sheet.
 */
export function OfficerActions({ raid, members, past, threadUrl }: Props) {
  const router = useRouter();
  const setToast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const sheetId = useId();
  const reasonId = useId();

  async function saveEdit(input: RaidInput): Promise<string | null> {
    try {
      const res = await patchRaid(raid.id, input);
      if (!res.ok) return failureMessage(res);
      setEditing(false);
      setToast({ tone: 'ok', title: RAID_TOASTS.edited(input.name) });
      router.refresh();
      return null;
    } catch {
      return SAVE_FAILED;
    }
  }

  async function setCancelled(cancelled: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await patchRaid(raid.id, cancelled ? { cancelled, reason: reason.trim() } : { cancelled });
      if (!res.ok) {
        setConfirming(false);
        setToast({ tone: 'stop', title: await failureMessage(res) });
        return;
      }
      setConfirming(false);
      setOpen(false);
      setReason('');
      setToast({ tone: 'ok', title: cancelled ? RAID_TOASTS.cancelled(raid.name) : RAID_TOASTS.restored(raid.name) });
      router.refresh();
    } catch {
      setToast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={past || raid.cancelled}
          title={past ? OFFICER_ACTIONS.finished : raid.cancelled ? OFFICER_ACTIONS.restoreFirst : undefined}
          onClick={() => {
            setOpen(false);
            setEditing(true);
          }}
        >
          {OFFICER_ACTIONS.edit}
        </Button>
        {threadUrl ? (
          <ButtonLink href={threadUrl} variant="secondary" size="sm" target="_blank" rel="noreferrer">
            {OFFICER_ACTIONS.openThread}
          </ButtonLink>
        ) : (
          <Button variant="secondary" size="sm" disabled title={OFFICER_ACTIONS.notPostedHint}>
            {OFFICER_ACTIONS.notPosted}
          </Button>
        )}
        {raid.cancelled ? (
          <Button variant="secondary" size="sm" disabled={past} title={past ? OFFICER_ACTIONS.finished : undefined} loading={busy} onClick={() => setCancelled(false)}>
            {OFFICER_ACTIONS.restore}
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            disabled={past}
            title={past ? OFFICER_ACTIONS.finished : undefined}
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          >
            {OFFICER_ACTIONS.cancel}
          </Button>
        )}
      </div>
      {!past && !raid.cancelled && <OnBehalfForm raidId={raid.id} members={members} onToast={setToast} onDone={() => setOpen(false)} />}
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

      <Modal open={editing} onClose={() => setEditing(false)} title={OFFICER_ACTIONS.editTitle}>
        {editing && <RaidForm initial={raidToInput(raid)} submitLabel={OFFICER_ACTIONS.save} onSubmit={saveEdit} onCancel={() => setEditing(false)} />}
      </Modal>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={OFFICER_ACTIONS.cancelTitle}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {OFFICER_ACTIONS.keep}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => setCancelled(true)}>
              {OFFICER_ACTIONS.cancelConfirm}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p>{OFFICER_ACTIONS.cancelBody}</p>
          <Field label={OFFICER_ACTIONS.cancelReason} hint={OFFICER_ACTIONS.cancelReasonHint} id={reasonId}>
            <Textarea id={reasonId} rows={2} maxLength={500} value={reason} placeholder={OFFICER_ACTIONS.cancelReasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Modal>
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
