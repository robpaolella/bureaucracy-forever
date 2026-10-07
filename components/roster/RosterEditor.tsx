'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, ClassAvatar, CONTROL, Modal, RankBadge, Toast, type ToastData } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { emptyCharacter, RANK_LABEL, RANKS, type CharacterInput } from '@/lib/roster-edit';
import type { Rank } from '@/components/ui/Badges';
import { SAVE_FAILED } from '@/content/calendar';
import { EDITOR, EDITOR_TOASTS } from '@/content/roster-editor';
import { CharacterForm } from './CharacterForm';

export type EditorMember = {
  userId: string;
  discordName: string;
  /** The member's rank; the main, when there is one, mirrors it. */
  rank: Rank;
  main: (CharacterInput & { id: string }) | null;
  alts: (CharacterInput & { id: string })[];
};

type Props = { members: EditorMember[] };
type Character = CharacterInput & { id: string };
type Editing =
  | { kind: 'add-main'; member: EditorMember }
  | { kind: 'add-alt'; member: EditorMember }
  | { kind: 'edit-main'; member: EditorMember; character: Character }
  | { kind: 'edit-alt'; member: EditorMember; character: Character };
type Confirmation = { kind: 'remove' | 'make-main'; character: Character };

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
}

async function failureMessage(res: Response): Promise<string> {
  if (res.status !== 400 && res.status !== 409) return SAVE_FAILED;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? SAVE_FAILED;
}

/**
 * One row per guild member with their main, or "No main yet", an Add button and a rank
 * select, since rank is theirs whether or not a main exists. Edit opens the character form
 * in a modal; removal asks first. Every write goes through the roster API and refreshes the
 * page, so the roster, the raid counts and the Discord roles follow at once.
 */
export function RosterEditor({ members }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [ranking, setRanking] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  async function setRank(m: EditorMember, rank: Rank) {
    if (ranking || rank === m.rank) return;
    setRanking(m.userId);
    try {
      const res = await send(`/api/roster/members/${m.userId}`, 'PATCH', { rank });
      if (!res.ok) {
        setToast({ tone: 'stop', title: await failureMessage(res) });
        return;
      }
      setToast({ tone: 'ok', title: EDITOR_TOASTS.ranked(m.discordName, RANK_LABEL[rank]) });
      router.refresh();
    } finally {
      setRanking(null);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.discordName.toLowerCase().includes(q) || m.main?.name.toLowerCase().includes(q) || m.alts.some((alt) => alt.name.toLowerCase().includes(q)));
  }, [members, search]);

  async function save(input: CharacterInput): Promise<string | null> {
    if (!editing) return null;
    let res: Response;
    if (editing.kind === 'add-main' || editing.kind === 'add-alt') {
      res = await send('/api/roster', 'POST', { userId: editing.member.userId, ...(editing.kind === 'add-alt' ? { alt: true } : {}), ...input });
    } else {
      res = await send(`/api/roster/${editing.character.id}`, 'PATCH', input);
    }
    if (!res.ok) return failureMessage(res);
    setToast({ tone: 'ok', title: editing.kind === 'add-main' || editing.kind === 'add-alt' ? EDITOR_TOASTS.added(input.name) : EDITOR_TOASTS.saved(input.name) });
    setEditing(null);
    router.refresh();
    return null;
  }

  async function confirm() {
    if (!confirmation || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      const res = confirmation.kind === 'remove' ? await send(`/api/roster/${confirmation.character.id}`, 'DELETE') : await send(`/api/roster/${confirmation.character.id}/main`, 'POST');
      if (!res.ok) {
        // A native dialog makes the page behind it inert, including its toast.
        setConfirmError(await failureMessage(res));
        return;
      }
      setToast({ tone: 'ok', title: confirmation.kind === 'remove' ? EDITOR_TOASTS.removed(confirmation.character.name) : EDITOR_TOASTS.madeMain(confirmation.character.name) });
      // Close the confirm first so its focus return lands on the still-mounted form, then the form.
      setConfirmation(null);
      await new Promise((r) => setTimeout(r, 0));
      setEditing(null);
      router.refresh();
    } catch {
      setConfirmError(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-card border border-line bg-ink-850 p-3 sm:flex-row sm:items-center sm:justify-between">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={EDITOR.search} aria-label={EDITOR.search} className={cn(CONTROL, 'h-11 px-3.5 sm:w-[260px]')} />
        <span className="tabular text-sm text-fg-3">{EDITOR.summary(shown.length, members.length)}</span>
      </div>

      {shown.length === 0 ? (
        <p role="status" className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-2">
          {EDITOR.empty}
        </p>
      ) : (
        <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
          {shown.map((m) => (
            <li key={m.userId}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <ClassAvatar name={m.discordName} wowClass={m.main?.wowClass} size={28} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="truncate text-[15px] font-semibold" style={{ color: m.main ? CLASS_COLORS[m.main.wowClass].onInk : undefined }}>
                      {m.discordName}
                    </span>
                    <RankBadge rank={m.rank} />
                  </div>
                  <span className="truncate text-[13px] text-fg-3">
                    {m.main ? `${m.main.name} · ${CLASS_COLORS[m.main.wowClass].label} · ${m.main.spec} · ${ROLE_LABELS[m.main.role]}` : EDITOR.noMain}
                  </span>
                </div>
                {!m.main &&
                  (m.rank === 'officer' ? (
                    <span className="text-small text-fg-3">{EDITOR.officerRank}</span>
                  ) : (
                    <select aria-label={EDITOR.rankFor(m.discordName)} value={m.rank} disabled={ranking === m.userId} onChange={(e) => setRank(m, e.target.value as Rank)} className={cn(CONTROL, 'h-11 w-32 px-2 text-sm')}>
                      {RANKS.filter((r) => r !== 'officer').map((r) => (
                        <option key={r} value={r}>
                          {RANK_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  ))}
                {m.main ? (
                  <div className="flex flex-wrap gap-2.5">
                    <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'edit-main', member: m, character: m.main! })} aria-label={`${EDITOR.edit} ${m.main.name}`}>
                      {EDITOR.edit}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'add-alt', member: m })} aria-label={`${EDITOR.addAlt} for ${m.discordName}`}>
                      {EDITOR.addAlt}
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'add-main', member: m })} aria-label={`${EDITOR.add} for ${m.discordName}`}>
                    {EDITOR.add}
                  </Button>
                )}
              </div>
              {m.alts.length > 0 && (
                <ul className="border-t border-line-faint bg-ink-850/40">
                  {m.alts.map((alt) => (
                    <li key={alt.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-faint px-4 py-3 first:border-t-0 sm:pl-[60px]">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-3">{alt.name} · {CLASS_COLORS[alt.wowClass].label} · {alt.spec} · {ROLE_LABELS[alt.role]}</span>
                      <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'edit-alt', member: m, character: alt })} aria-label={`${EDITOR.edit} ${alt.name}`}>
                        {EDITOR.edit}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.kind === 'add-main' ? `${EDITOR.addTitle} · ${editing.member.discordName}` : editing?.kind === 'add-alt' ? `${EDITOR.addAltTitle} · ${editing.member.discordName}` : editing?.kind === 'edit-alt' ? EDITOR.editAltTitle : EDITOR.editTitle}>
        {editing && (
          <CharacterForm
            initial={'character' in editing ? editing.character : { ...emptyCharacter(), rank: editing.member.rank }}
            submitLabel={editing.kind === 'add-main' ? EDITOR.create : editing.kind === 'add-alt' ? EDITOR.createAlt : EDITOR.save}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            showRank={editing.kind !== 'add-alt' && editing.kind !== 'edit-alt'}
            onRemove={'character' in editing ? () => { setConfirmError(null); setConfirmation({ kind: 'remove', character: editing.character }); } : undefined}
            onMakeMain={editing.kind === 'edit-alt' ? () => { setConfirmError(null); setConfirmation({ kind: 'make-main', character: editing.character }); } : undefined}
          />
        )}
      </Modal>

      <Modal
        open={confirmation !== null}
        onClose={() => { if (!busy) setConfirmation(null); }}
        title={confirmation?.kind === 'make-main' ? EDITOR.makeMainTitle : EDITOR.removeTitle}
        actions={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmation(null)}>
              {EDITOR.keep}
            </Button>
            <Button variant={confirmation?.kind === 'make-main' ? 'primary' : 'danger'} loading={busy} onClick={confirm}>
              {confirmation?.kind === 'make-main' ? EDITOR.makeMainConfirm : EDITOR.removeConfirm}
            </Button>
          </>
        }
      >
        {confirmation?.kind === 'make-main' ? EDITOR.makeMainBody : editing?.kind === 'edit-alt' ? EDITOR.removeAltBody : EDITOR.removeBody}
        {confirmError && <p role="alert" className="mt-3 text-sm text-stop">{confirmError}</p>}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
