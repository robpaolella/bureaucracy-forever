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
};

type Props = { members: EditorMember[] };

type Editing = { kind: 'add'; member: EditorMember } | { kind: 'edit'; member: EditorMember; main: CharacterInput & { id: string } };

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
  const [removing, setRemoving] = useState<(CharacterInput & { id: string }) | null>(null);
  const [busy, setBusy] = useState(false);
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
      setToast({ tone: 'ok', title: EDITOR_TOASTS.ranked(m.main?.name ?? m.discordName, RANK_LABEL[rank]) });
      router.refresh();
    } finally {
      setRanking(null);
    }
  }

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => m.discordName.toLowerCase().includes(q) || m.main?.name.toLowerCase().includes(q));
  }, [members, search]);

  async function save(input: CharacterInput): Promise<string | null> {
    if (!editing) return null;
    const res = editing.kind === 'add' ? await send('/api/roster', 'POST', { userId: editing.member.userId, ...input }) : await send(`/api/roster/${editing.main.id}`, 'PATCH', input);
    if (!res.ok) return failureMessage(res);
    setToast({ tone: 'ok', title: editing.kind === 'add' ? EDITOR_TOASTS.added(input.name) : EDITOR_TOASTS.saved(input.name) });
    setEditing(null);
    router.refresh();
    return null;
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    const res = await send(`/api/roster/${removing.id}`, 'DELETE');
    setBusy(false);
    if (!res.ok) {
      // Stay put so the officer can retry or back out; only the toast changes.
      setToast({ tone: 'stop', title: await failureMessage(res) });
      return;
    }
    setToast({ tone: 'ok', title: EDITOR_TOASTS.removed(removing.name) });
    // Close the confirm first so its focus return lands on the still-mounted form, then the form.
    setRemoving(null);
    await new Promise((r) => setTimeout(r, 0));
    setEditing(null);
    router.refresh();
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
            <li key={m.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <ClassAvatar name={m.main?.name ?? m.discordName} wowClass={m.main?.wowClass} size={28} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  {m.main ? (
                    <span className="truncate text-[15px] font-semibold" style={{ color: CLASS_COLORS[m.main.wowClass].onInk }}>
                      {m.main.name}
                    </span>
                  ) : (
                    <span className="text-[15px] text-fg-3">{EDITOR.noMain}</span>
                  )}
                  <RankBadge rank={m.rank} />
                </div>
                <span className="truncate text-[13px] text-fg-3">
                  {m.discordName}
                  {m.main && ` · ${CLASS_COLORS[m.main.wowClass].label} · ${m.main.spec} · ${ROLE_LABELS[m.main.role]}`}
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
                <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'edit', member: m, main: m.main! })} aria-label={`${EDITOR.edit} ${m.main.name}`}>
                  {EDITOR.edit}
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'add', member: m })} aria-label={`${EDITOR.add} for ${m.discordName}`}>
                  {EDITOR.add}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing?.kind === 'add' ? `${EDITOR.addTitle} · ${editing.member.discordName}` : EDITOR.editTitle}>
        {editing && (
          <CharacterForm
            initial={editing.kind === 'edit' ? editing.main : { ...emptyCharacter(), rank: editing.member.rank }}
            submitLabel={editing.kind === 'add' ? EDITOR.create : EDITOR.save}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            onRemove={editing.kind === 'edit' ? () => setRemoving(editing.main) : undefined}
          />
        )}
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={EDITOR.removeTitle}
        actions={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {EDITOR.keep}
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              {EDITOR.removeConfirm}
            </Button>
          </>
        }
      >
        {EDITOR.removeBody}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
