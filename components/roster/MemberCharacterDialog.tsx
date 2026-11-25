'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Button, ClassAvatar, FIELD_LABEL, Modal, Toast, type ToastData } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { MEMBER_EDITOR, EDITOR_TOASTS } from '@/content/roster-editor';
import { cn } from '@/lib/cn';
import { CLASS_COLORS, ROLE_LABELS } from '@/lib/design/class-colors';
import { emptyCharacter, type CharacterInput } from '@/lib/roster-edit';
import { CharacterForm } from './CharacterForm';

export type MemberCharacter = Omit<CharacterInput, 'rank'> & { id: string; isMain: boolean; isDefault?: boolean };
type EditableCharacter = CharacterInput & { id: string; isMain?: boolean };
type ApiCharacter = { id: string; name: string; class: string; spec: string; raidRole: string; isMain: boolean; isDefault?: boolean };

function fromApi(character: ApiCharacter): MemberCharacter {
  return {
    id: character.id,
    name: character.name,
    wowClass: character.class.toLowerCase() as MemberCharacter['wowClass'],
    spec: character.spec,
    role: character.raidRole.toLowerCase() as MemberCharacter['role'],
    isMain: character.isMain,
    isDefault: character.isDefault === true,
  };
}
type Editing = { kind: 'add'; main: boolean } | { kind: 'edit'; character: EditableCharacter };

export type MemberCharacterDialogProps = {
  characters: MemberCharacter[];
  rank: CharacterInput['rank'];
};

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  return fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
}

async function failureMessage(res: Response): Promise<string> {
  if (res.status !== 400 && res.status !== 403 && res.status !== 409) return SAVE_FAILED;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? SAVE_FAILED;
}

/** A member's own characters only. The API enforces ownership; this is the roster entry point. */
export function MemberCharacterDialog({ characters: initialCharacters, rank }: MemberCharacterDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [characters, setCharacters] = useState(initialCharacters);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: 'remove' | 'make-main'; character: EditableCharacter } | null>(null);
  /** Set when the list can't be reloaded: 'saved' if the change went through, 'failed' if it didn't. */
  const [stale, setStale] = useState<'saved' | 'failed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  /** The roster renders this dialog for desktop and phone; one radio group name each keeps them from unchecking each other. */
  const group = useId();
  const [defaultError, setDefaultError] = useState(false);
  const defaultId = characters.find((character) => character.isDefault)?.id ?? null;
  const main = characters.find((character) => character.isMain) ?? null;
  /** Reloads the list; when that fails the old list is hidden rather than shown as current. */
  async function refreshCharacters(staleKind: 'saved' | 'failed') {
    router.refresh();
    try {
      const res = await send('/api/me/characters', 'GET');
      if (!res.ok) throw new Error('reload failed');
      const next = ((await res.json()) as ApiCharacter[]).map(fromApi);
      setCharacters([...next.filter((c) => c.isMain), ...next.filter((c) => !c.isMain)]);
      setStale(null);
    } catch {
      setStale(staleKind);
    }
  }

  /** The "Sign up with" setting: saves at once, and on a failure keeps the old value and marks the list invalid. */
  async function chooseDefault(character: MemberCharacter | null) {
    if (busy) return;
    setBusy(true);
    setDefaultError(false);
    try {
      const res = await send('/api/me/characters/default', 'PUT', { characterId: character?.id ?? null });
      if (!res.ok) {
        setDefaultError(true);
        // A 404 means the character is gone; the reload drops it from the list.
        if (res.status === 404) await refreshCharacters('failed');
        return;
      }
      setCharacters(characters.map((c) => ({ ...c, isDefault: c.id === character?.id })));
      setToast({ tone: 'ok', title: character ? EDITOR_TOASTS.signUpWith(character.name) : EDITOR_TOASTS.askEachTime });
    } catch {
      setDefaultError(true);
    } finally {
      setBusy(false);
    }
  }

  async function save(input: CharacterInput): Promise<string | null> {
    if (!editing) return null;
    try {
      const res = editing.kind === 'add'
        ? await send('/api/me/characters', 'POST', editing.main ? { ...input, main: true } : input)
        : await send(`/api/me/characters/${editing.character.id}`, 'PATCH', input);
      if (!res.ok) {
        if (res.status === 404) {
          setEditing(null);
          await refreshCharacters('failed');
          setToast({ tone: 'stop', title: SAVE_FAILED });
          return null;
        }
        return failureMessage(res);
      }
      await refreshCharacters('saved');
      setToast({ tone: 'ok', title: editing.kind === 'add' ? EDITOR_TOASTS.added(input.name) : EDITOR_TOASTS.saved(input.name) });
      setEditing(null);
      return null;
    } catch {
      return SAVE_FAILED;
    }
  }

  async function confirm() {
    if (!confirmation || busy) return;
    const { kind, character } = confirmation;
    setBusy(true);
    setConfirmError(null);
    try {
      const res = kind === 'remove'
        ? await send(`/api/me/characters/${character.id}`, 'DELETE')
        : await send(`/api/me/characters/${character.id}/main`, 'POST');
      if (!res.ok) {
        if (res.status === 404) {
          setConfirmation(null);
          setEditing(null);
          await refreshCharacters('failed');
          setToast({ tone: 'stop', title: SAVE_FAILED });
          return;
        }
        setConfirmError(await failureMessage(res));
        return;
      }
      setConfirmation(null);
      setEditing(null);
      await refreshCharacters('saved');
      setToast({ tone: 'ok', title: kind === 'remove' ? EDITOR_TOASTS.removed(character.name) : EDITOR_TOASTS.madeOwnMain(character.name) });
    } catch {
      setConfirmError(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setEditing(null);
    setConfirmation(null);
    setDefaultError(false);
    setOpen(false);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} aria-label={MEMBER_EDITOR.manageCharacters}>
        {MEMBER_EDITOR.manageCharacters}
      </Button>
      <Modal open={open} onClose={close} title={editing ? (editing.kind === 'add' ? (editing.main ? MEMBER_EDITOR.addMainTitle : MEMBER_EDITOR.addAltTitle) : editing.character.isMain ? MEMBER_EDITOR.editMainTitle : MEMBER_EDITOR.editAltTitle) : MEMBER_EDITOR.title}>
        {editing ? (
          <CharacterForm
            initial={editing.kind === 'add' ? { ...emptyCharacter(), rank } : editing.character}
            submitLabel={editing.kind === 'add' ? (editing.main ? MEMBER_EDITOR.addMain : MEMBER_EDITOR.addAlt) : MEMBER_EDITOR.save}
            onSubmit={save}
            onCancel={() => setEditing(null)}
            showRank={false}
            onRemove={editing.kind === 'edit' && !editing.character.isMain ? () => { setConfirmError(null); setConfirmation({ kind: 'remove', character: editing.character }); } : undefined}
            onMakeMain={editing.kind === 'edit' && !editing.character.isMain ? () => { setConfirmError(null); setConfirmation({ kind: 'make-main', character: editing.character }); } : undefined}
            classHint={editing.kind === 'edit' && editing.character.isMain ? MEMBER_EDITOR.mainClassHint : undefined}
          />
        ) : stale ? (
          <div className="flex flex-col gap-4">
            <p>{stale === 'failed' ? MEMBER_EDITOR.staleFailedBody : MEMBER_EDITOR.staleBody}</p>
            <Button onClick={() => { void refreshCharacters(stale); }}>{MEMBER_EDITOR.reload}</Button>
          </div>
        ) : !main ? (
          <Button onClick={() => setEditing({ kind: 'add', main: true })}>{MEMBER_EDITOR.addMain}</Button>
        ) : (
          <div className="flex flex-col gap-4">
            {characters.length === 1 ? (
              <div className="flex flex-col gap-1.5">
                <span className={FIELD_LABEL}>{MEMBER_EDITOR.signUpWith}</span>
                <p className="text-sm text-fg-2"><span className="font-semibold text-fg">{main.name}</span>{MEMBER_EDITOR.onlyCharacter}</p>
              </div>
            ) : null}
            <fieldset className={cn(characters.length === 1 ? 'contents' : 'flex flex-col gap-2.5')} aria-describedby={characters.length === 1 || !defaultError ? undefined : `${group}-note`} aria-invalid={defaultError && characters.length > 1 ? true : undefined}>
              {characters.length > 1 && (
                <>
                  <legend className={cn(FIELD_LABEL, 'mb-1')}>{MEMBER_EDITOR.signUpWith}</legend>
                  <span className="text-xs text-fg-3">{MEMBER_EDITOR.signUpWithHint}</span>
                </>
              )}
              <ul className={cn('divide-y divide-line-faint rounded-card border bg-ink-900', defaultError && characters.length > 1 ? 'border-stop' : 'border-line')}>
                {characters.length > 1 && (
                  <li className="flex items-center gap-3 px-4 py-3">
                    <label className="flex min-h-11 flex-1 items-center gap-3 text-sm font-semibold text-fg">
                      <input type="radio" name={group} className="h-4 w-4 shrink-0 accent-teal" checked={defaultId === null} disabled={busy} onChange={() => { void chooseDefault(null); }} />
                      {MEMBER_EDITOR.askEachTime}
                    </label>
                  </li>
                )}
                {characters.map((character) => (
                  <li key={character.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {characters.length > 1 && (
                      <label className="-m-3.5 flex shrink-0 p-3.5">
                        <input type="radio" name={group} aria-label={`Sign up with ${character.name}`} className="h-4 w-4 shrink-0 accent-teal" checked={defaultId === character.id} disabled={busy} onChange={() => { void chooseDefault(character); }} />
                      </label>
                    )}
                    <ClassAvatar name={character.name} wowClass={character.wowClass} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: CLASS_COLORS[character.wowClass].onInk }}>{character.name}</p>
                      <p className="truncate text-[13px] text-fg-3">{CLASS_COLORS[character.wowClass].label} · {character.spec} · {ROLE_LABELS[character.role]}</p>
                    </div>
                    {character.isMain && <span className="text-small text-fg-3">{MEMBER_EDITOR.main}</span>}
                    <Button variant="secondary" size="sm" onClick={() => setEditing({ kind: 'edit', character: { ...character, rank } })} aria-label={`Edit ${character.name}`}>{MEMBER_EDITOR.edit}</Button>
                  </li>
                ))}
              </ul>
              {defaultError && characters.length > 1 && <span id={`${group}-note`} role="alert" className="text-xs text-stop">{SAVE_FAILED}</span>}
            </fieldset>
            <Button onClick={() => setEditing({ kind: 'add', main: false })}>{MEMBER_EDITOR.addAlt}</Button>
          </div>
        )}
      </Modal>
      <Modal
        open={confirmation !== null}
        onClose={() => { if (!busy) setConfirmation(null); }}
        title={confirmation?.kind === 'make-main' ? MEMBER_EDITOR.makeMainTitle(confirmation.character.name) : MEMBER_EDITOR.removeTitle}
        actions={<><Button variant="ghost" disabled={busy} onClick={() => setConfirmation(null)}>{MEMBER_EDITOR.keep}</Button><Button variant={confirmation?.kind === 'make-main' ? 'primary' : 'danger'} loading={busy} onClick={confirm}>{confirmation?.kind === 'make-main' ? MEMBER_EDITOR.makeMainConfirm : MEMBER_EDITOR.removeConfirm}</Button></>}
      >
        {confirmation?.kind === 'make-main' ? MEMBER_EDITOR.makeMainBody : MEMBER_EDITOR.removeBody}
        {confirmError && <p role="alert" className="mt-3 text-sm text-stop">{confirmError}</p>}
      </Modal>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
