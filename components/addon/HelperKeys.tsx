'use client';

import { useRef, useState, type FormEvent } from 'react';
import { createHelperKeyAction, revokeHelperKeyAction } from '@/app/actions/helper-keys';
import { LocalTime } from '@/components/time/LocalTime';
import { useViewerTimeZone } from '@/components/time/useViewerTimeZone';
import { Button, Field, Input, Modal, useToast } from '@/components/ui';
import { GUILD_TIMEZONE } from '@/lib/config';
import { HELPER_KEYS as COPY } from './copy';

/** One of the officer's own keys; times are ISO instants. */
export type KeyView = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

/** "Oct 13, 2026, 9:12 PM EDT": the date in the viewer's zone, then LocalTime, with guild time on hover and focus. */
function When({ at }: { at: string }) {
  const zone = useViewerTimeZone()?.zone ?? GUILD_TIMEZONE;
  const date = new Intl.DateTimeFormat('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(at));
  return <>{date}</>;
}

function LastUsed({ at }: { at: string | null }) {
  if (!at) return <>{COPY.neverUsed}</>;
  return (
    <>
      {COPY.lastUsed} <When at={at} />, <LocalTime startsAt={at} durationMin={0} weekday="guild" className="text-[13px] font-normal text-fg-2" />
    </>
  );
}

/** Helper keys: create (shown once), the officer's own list, revoke with a confirmation. */
/** `nameMax` comes from the page: lib/helper-keys is server-only. */
export function HelperKeys({ keys, nameMax }: { keys: KeyView[]; nameMax: number }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ name: string; key: string } | null>(null);
  const [revoking, setRevoking] = useState<KeyView | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createHelperKeyAction(name);
      if (result.ok) {
        setMade({ name: result.name, key: result.key });
        setName('');
      } else setError(result.error);
    } catch {
      // Server or network failure: the typed name stays so the officer can press Create key again.
      toast({ tone: 'stop', title: COPY.saveFailed.title, detail: COPY.saveFailed.detail });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!revoking || revokeBusy) return;
    setRevokeBusy(true);
    let failure: string | null = null;
    try {
      const result = await revokeHelperKeyAction(revoking.id);
      if (!result.ok) failure = result.error;
    } catch {
      failure = COPY.revokeFailed.title;
    }
    setRevokeBusy(false);
    // The window closes first: a toast under an open dialog's backdrop would not be seen.
    setRevoking(null);
    if (failure) toast({ tone: 'stop', title: failure, detail: COPY.revokeFailed.detail });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="helper-keys">
      <h2 id="helper-keys" className="font-display text-2xl font-medium">{COPY.heading}</h2>
      <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{COPY.lede}</p>
      <form onSubmit={create} noValidate className="flex max-w-[720px] flex-col gap-3 rounded-card border border-line bg-ink-900 p-4 md:p-[17px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Field label={COPY.nameLabel} hint={COPY.nameHint} error={error ? <span role="alert">{error}</span> : undefined} className="min-w-0 flex-1">
            <Input value={name} maxLength={nameMax} autoComplete="off" onChange={(event) => { setName(event.target.value); setError(null); }} />
          </Field>
          <Button type="submit" loading={busy} className="max-sm:w-full sm:mt-[26px]">{COPY.create}</Button>
        </div>
      </form>
      {made && <KeyReveal made={made} onDone={() => setMade(null)} />}
      {keys.length === 0 ? (
        !made && <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-sm text-fg-2">{COPY.empty}</p>
      ) : (
        <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <span className="flex min-w-0 flex-1 basis-[14rem] flex-col">
                <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">{key.name}</span>
                <span className="text-[13px] text-fg-3">
                  {COPY.created} <When at={key.createdAt} /> · <LastUsed at={key.lastUsedAt} />
                </span>
              </span>
              <Button variant="ghost" size="sm" className="text-stop" aria-label={`${COPY.revoke} ${key.name}`} onClick={() => setRevoking(key)}>{COPY.revoke}</Button>
            </li>
          ))}
        </ul>
      )}
      <Modal
        open={revoking !== null}
        onClose={() => !revokeBusy && setRevoking(null)}
        title={COPY.revokeTitle}
        actions={
          <>
            <Button variant="ghost" disabled={revokeBusy} onClick={() => setRevoking(null)}>{COPY.cancel}</Button>
            <Button variant="danger" loading={revokeBusy} onClick={() => void revoke()}>{COPY.revokeAction}</Button>
          </>
        }
      >
        {revoking && <p>{COPY.revokeConfirm(revoking.name)}</p>}
      </Modal>
    </section>
  );
}

/** The new key, once, in a highlighted box. It lives only in this component's state. */
function KeyReveal({ made, onDone }: { made: { name: string; key: string }; onDone: () => void }) {
  const text = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(made.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused: select the key so the officer can copy it by hand.
      const node = text.current;
      if (node) window.getSelection()?.selectAllChildren(node);
    }
  }

  return (
    <div role="status" className="flex flex-col gap-3 rounded-card border border-teal-line bg-teal-wash p-4 text-teal-text">
      <strong className="text-[15px] font-semibold text-fg [overflow-wrap:anywhere]">{COPY.createdTitle(made.name)}</strong>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <code ref={text} className="min-w-0 flex-1 select-all break-all rounded-control border border-line-strong bg-ink-800 px-3.5 py-3 font-mono text-sm text-fg">{made.key}</code>
        <Button onClick={() => void copy()}>{copied ? COPY.copied : COPY.copy}</Button>
      </div>
      <span>{COPY.createdNote}</span>
      <span><Button variant="secondary" onClick={onDone}>{COPY.done}</Button></span>
    </div>
  );
}
