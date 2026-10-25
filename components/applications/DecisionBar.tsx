'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Choice, ChoiceGroup, Field, Modal, Textarea, useToast } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { ACTIONS } from '@/content/applications';
import { DECISION_MESSAGE_MAX } from '@/lib/applications-decide';
import type { StandardMessages } from '@/lib/applications-data';

type Props = {
  id: string;
  /** The applicant's Discord name. */
  name: string;
  path: 'raider' | 'social';
  pending: boolean;
  /** The messages a standard decision sends, built on the server from the character name. */
  messages: StandardMessages;
};

type Pending = 'accepted' | 'declined' | null;
type DeclineKind = 'standard' | 'custom' | 'none';

async function failureMessage(res: Response): Promise<string> {
  if (res.status !== 400 && res.status !== 409) return SAVE_FAILED;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? SAVE_FAILED;
}

/** The custom text as the server counts it: trimmed, in Unicode code points. */
function customProblem(text: string): string | null {
  const length = [...text.trim()].length;
  if (length === 0) return ACTIONS.customEmpty;
  return length > DECISION_MESSAGE_MAX ? ACTIONS.customTooLong(DECISION_MESSAGE_MAX) : null;
}

/**
 * docs/04 § Application detail § Actions: pinned to the bottom of the pane on an ink-900
 * bar so it stays reachable on a long application. Decline offers the standard message, the
 * officer's own or none; Accept on a raider-path application asks Raider or Social, and on a
 * social one confirms directly (SYNC-SPEC §9.2). Move to social is a ghost action for a
 * raider who fits better there. A failure keeps the window open, and the typed message with
 * it; closing a window that hit a conflict refreshes the page to show the real state. After a
 * decision the page refreshes: the pill updates and the row leaves the Pending filter.
 */
export function DecisionBar({ id, name, path, pending, messages }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DeclineKind>('standard');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [refused, setRefused] = useState(false);
  const setToast = useToast();

  function close() {
    if (busy) return;
    setConfirming(null);
    setError(null);
    setRefused(false);
    if (conflict) {
      setConflict(false);
      router.refresh();
    }
  }

  function open(next: Exclude<Pending, null>) {
    setError(null);
    setRefused(false);
    setConfirming(next);
  }

  async function send(body: unknown, done: string, note?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
      if (!res.ok) {
        const reason = await failureMessage(res);
        if (res.status === 409) {
          // Another officer got there first: keep the window for the reason, refresh when it closes.
          setConflict(true);
          setError(ACTIONS.conflict(reason));
        } else {
          setError(reason);
        }
        return;
      }
      setToast({ tone: 'ok', title: done, detail: note });
      setConfirming(null);
      router.refresh();
    } catch {
      setError(SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function decline() {
    if (kind === 'custom') {
      if (customProblem(custom)) {
        setRefused(true);
        return;
      }
      return send({ status: 'declined', message: { kind, text: custom.trim() } }, ACTIONS.declined(name), ACTIONS.dmNote);
    }
    return send({ status: 'declined', message: { kind } }, ACTIONS.declined(name), kind === 'none' ? undefined : ACTIONS.dmNote);
  }

  const accept = (acceptAs: 'raider' | 'social') => send({ status: 'accepted', acceptAs }, ACTIONS.accepted(name), ACTIONS.dmNote);

  const declining = confirming === 'declined';
  const raiderAccept = confirming === 'accepted' && path === 'raider';
  const problem = refused && kind === 'custom' ? customProblem(custom) : null;
  const count = [...custom.trim()].length;
  // The toast lives in the view's ToastHost, so it survives this bar leaving after a decision.
  if (!pending) return null;
  return (
    <>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2.5 border-t border-line bg-ink-900 px-4 py-3 md:-mx-0 md:rounded-b-card md:px-0" role="group" aria-label="Decision">
        <Button onClick={() => open('accepted')}>{ACTIONS.accept}</Button>
        <Button variant="danger" onClick={() => open('declined')}>
          {ACTIONS.decline}
        </Button>
        {path === 'raider' && (
          <Button variant="ghost" loading={busy && confirming === null} onClick={() => send({ path: 'social' }, ACTIONS.movedToSocial(name))}>
            {ACTIONS.toSocial}
          </Button>
        )}
      </div>

      <Modal
        open={confirming !== null}
        onClose={close}
        title={declining ? ACTIONS.declineTitle(name) : ACTIONS.acceptTitle(name)}
        actions={
          <>
            <Button variant="ghost" disabled={busy} onClick={close} className="whitespace-nowrap">
              {ACTIONS.keep}
            </Button>
            {declining ? (
              <Button variant="danger" loading={busy} onClick={decline}>
                {{ standard: ACTIONS.declineConfirmStandard, custom: ACTIONS.declineConfirmCustom, none: ACTIONS.declineConfirmNone }[kind]}
              </Button>
            ) : raiderAccept ? (
              <>
                <Button variant="secondary" disabled={busy} onClick={() => accept('social')} className="whitespace-nowrap">
                  {ACTIONS.acceptSocial}
                </Button>
                <Button loading={busy} onClick={() => accept('raider')}>
                  {ACTIONS.acceptRaider}
                </Button>
              </>
            ) : (
              <Button loading={busy} onClick={() => accept('social')}>
                {ACTIONS.acceptConfirm}
              </Button>
            )}
          </>
        }
      >
        {declining ? (
          <div className="flex flex-col gap-4">
            <p>{ACTIONS.declineBody}</p>
            <ChoiceGroup legend={ACTIONS.declineChoiceLegend}>
              <Choice card type="radio" name="decline-message" checked={kind === 'standard'} onChange={() => setKind('standard')} label={ACTIONS.declineStandard} />
              <Choice card type="radio" name="decline-message" checked={kind === 'custom'} onChange={() => setKind('custom')} label={ACTIONS.declineCustom} />
              <Choice card type="radio" name="decline-message" checked={kind === 'none'} onChange={() => setKind('none')} label={ACTIONS.declineNone} />
            </ChoiceGroup>
            {kind === 'standard' && <p className="whitespace-pre-line rounded-control border border-line bg-ink-700 px-3.5 py-3 text-fg">{messages.declined}</p>}
            {kind === 'custom' && (
              <Field label={ACTIONS.customLabel} hint={ACTIONS.customCount(count, DECISION_MESSAGE_MAX)} error={problem}>
                <Textarea rows={5} value={custom} placeholder={ACTIONS.customPlaceholder} onChange={(e) => setCustom(e.target.value)} />
              </Field>
            )}
            <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-2">
              {ACTIONS.declineEffects.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p>{raiderAccept ? ACTIONS.acceptRaiderQuestion : ACTIONS.acceptSocialBody}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-fg-2">
              {(raiderAccept ? ACTIONS.acceptRaiderEffects : ACTIONS.acceptSocialEffects).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-fg-3">{ACTIONS.messageGoesOut}</p>
            <p className="whitespace-pre-line rounded-control border border-line bg-ink-700 px-3.5 py-3 text-fg">{raiderAccept ? messages.raider : messages.social}</p>
            {raiderAccept && (
              <>
                <p>{ACTIONS.acceptAsSocialNote}</p>
                <p className="whitespace-pre-line rounded-control border border-line bg-ink-700 px-3.5 py-3 text-fg">{messages.social}</p>
              </>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-stop">
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
