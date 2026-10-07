'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ClassAvatar, Modal, Toast, type ToastData } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { MEMBER_EDITOR, EDITOR_TOASTS } from '@/content/roster-editor';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { emptyCharacter, type CharacterInput } from '@/lib/roster-edit';
import { CharacterForm } from './CharacterForm';

export type MemberCharacter = Omit<CharacterInput, 'rank'> & { id: string; isMain: boolean };
type EditableCharacter = CharacterInput & { id: string };
type ApiCharacter = { id: string; name: string; class: string; spec: string; raidRole: string; isMain: boolean };

function fromApi(character: ApiCharacter): MemberCharacter {
  return {
    id: character.id,
    name: character.name,
    wowClass: character.class.toLowerCase() as MemberCharacter['wowClass'],
    spec: character.spec,
    role: character.raidRole.toLowerCase() as MemberCharacter['role'],
    isMain: character.isMain,
  };
}
type Editing = { kind: 'add' } | { kind: 'edit'; character: EditableCharacter };

export type MemberCharacterDialogProps = {
  characters: MemberCharacter[];
  rank: CharacterInput['rank'];
};

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
}

async function failureMessage(res: Response): Promise<string> {
  if (res.status !== 400 && res.status !== 409) return SAVE_FAILED;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? SAVE_FAILED;
}

/** A member's own characters only. The API enforces ownership; this is the roster entry point. */
export function MemberCharacterDialog({ characters: initialCharacters, rank }: MemberCharacterDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [characters, setCharacters] = useState(initialCharacters);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<EditableCharacter | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  const main = characters.find((character) => character.isMain) ?? null;
  async function refreshCharacters() {
    const res = await send('/api/me/characters', 'GET');
    if (!res.ok) return false;
    setCharacters(((await res.json()) as ApiCharacter[]).map(fromApi));
    router.refresh();
    return true;
  }

  async function save(input: CharacterInput): Promise<string | null> {
    if (!editing) return null;
    try {
      const res = editing.kind === 'add'
        ? await send('/api/me/characters', 'POST', input)
        : await send(`/api/me/characters/${editing.character.id}`, 'PATCH', input);
      if (!res.ok) {
        if (res.status === 404) await refreshCharacters();
        return failureMessage(res);
      }
      await refreshCharacters();
      setToast({ tone: 'ok', title: editing.kind === 'add' ? EDITOR_TOASTS.added(input.name) : EDITOR_TOASTS.saved(input.name) });
      setEditing(null);
      return null;
    } catch {
      return SAVE_FAILED;
    }
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      const res = await send(`/api/me/characters/${removing.id}`, 'DELETE');
      if (!res.ok) {
        if (res.status === 404) await refreshCharacters();
        setConfirmError(await failureMessage(res));
        return;
      }
      setRemoving(null);
      setEditing(null);
      await refreshCharacters();
      setToast({ tone: 'ok', title: EDITOR_TOASTS.removed(removing.name) });
    } catch {
      setConfirmError(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setEditing(null);
    setRemoving(null);
    setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={MEMBER_EDITOR.manageCharacters}>
        {MEMBER_EDITOR.manageCharacters}
      </Button>
      <Modal open={open} onClose={close} title={editing ? (editing.kind === 'add' ? MEMBER_EDITOR.addAltTitle : MEMBER_EDITOR.editAltTitle) : MEMBER_EDITOR.title}>
        {editing ? (
          <CharacterForm
            initial={editing.kind === 'add' ? { ...emptyCharacter(), rank } : editing.character}
            submitLabel={editing.kind === 'add' ? MEMBER_EDITOR.addAlt : MEMBER_EDITOR.save}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            showRank={false}
            onRemove={editing.kind === 'edit' ? () => { setConfirmError(null); setRemoving(editing.character); } : undefined}
          />
        ) : !main ? (
          <p>{MEMBER_EDITOR.noMain}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
              {characters.map((character) => (
                <li key={character.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <ClassAvatar name={character.name} wowClass={character.wowClass} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" style={{ color: CLASS_COLORS[character.wowClass].onInk }}>{character.name}</p>
                    <p className="truncate text-[13px] text-fg-3">{CLASS_COLORS[character.wowClass].label} · {character.spec} · {ROLE_LABELS[character.role]}</p>
                  </div>
                  {character.isMain ? <span className="text-small text-fg-3">{MEMBER_EDITOR.main}</span> : <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'edit', character: { ...character, rank } })} aria-label={`Edit ${character.name}`}>{MEMBER_EDITOR.edit}</Button>}
                </li>
              ))}
            </ul>
            <Button onClick={() => setEditing({ kind: 'add' })}>{MEMBER_EDITOR.addAlt}</Button>
          </div>
        )}
      </Modal>
      <Modal
        open={removing !== null}
        onClose={() => { if (!busy) setRemoving(null); }}
        title={MEMBER_EDITOR.removeTitle}
        actions={<><Button variant="ghost" disabled={busy} onClick={() => setRemoving(null)}>{MEMBER_EDITOR.keep}</Button><Button variant="danger" loading={busy} onClick={remove}>{MEMBER_EDITOR.removeConfirm}</Button></>}
      >
        {MEMBER_EDITOR.removeBody}
        {confirmError && <p role="alert" className="mt-3 text-sm text-stop">{confirmError}</p>}
      </Modal>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
