'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Modal, useToast } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { ACTIONS } from '@/content/applications';

type Props = { id: string; character: string; path: 'raider' | 'social'; pending: boolean };

type Pending = 'accepted' | 'declined' | null;

async function failureMessage(res: Response): Promise<string> {
  if (res.status !== 400 && res.status !== 409) return SAVE_FAILED;
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? SAVE_FAILED;
}

/**
 * docs/04 § Application detail § Actions: pinned to the bottom of the pane on an ink-900
 * bar so it stays reachable on a long application. Accept and Decline confirm first,
 * naming what the applicant will be told; Move to social is a ghost action for a raider
 * who fits better there. After a decision the page refreshes: the pill updates and the
 * row leaves the Pending filter.
 */
export function DecisionBar({ id, character, path, pending }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const setToast = useToast();

  async function send(body: unknown, done: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/applications/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
      if (!res.ok) {
        setToast({ tone: 'stop', title: await failureMessage(res) });
        // A conflict means another officer got there first: show the real state.
        if (res.status === 409) {
          setConfirming(null);
          router.refresh();
        }
        return;
      }
      setToast({ tone: 'ok', title: done, detail: ACTIONS.dmNote });
      setConfirming(null);
      router.refresh();
    } catch {
      setToast({ tone: 'stop', title: SAVE_FAILED });
    } finally {
      setBusy(false);
    }
  }

  const confirm = confirming;
  // The toast lives in the view's ToastHost, so it survives this bar leaving after a decision.
  if (!pending) return null;
  return (
    <>
      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2.5 border-t border-line bg-ink-900 px-4 py-3 md:-mx-0 md:rounded-b-card md:px-0" role="group" aria-label="Decision">
        <Button onClick={() => setConfirming('accepted')}>{ACTIONS.accept}</Button>
        <Button variant="danger" onClick={() => setConfirming('declined')}>
          {ACTIONS.decline}
        </Button>
        {path === 'raider' && (
          <Button variant="ghost" loading={busy && confirming === null} onClick={() => send({ path: 'social' }, ACTIONS.movedToSocial(character))}>
            {ACTIONS.toSocial}
          </Button>
        )}
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirming(null)}
        title={confirm === 'declined' ? ACTIONS.declineTitle(character) : ACTIONS.acceptTitle(character)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              {ACTIONS.keep}
            </Button>
            {confirm === 'declined' ? (
              <Button variant="danger" loading={busy} onClick={() => send({ status: 'declined' }, ACTIONS.declined(character))}>
                {ACTIONS.declineConfirm}
              </Button>
            ) : (
              <Button loading={busy} onClick={() => send({ status: 'accepted' }, ACTIONS.accepted(character))}>
                {ACTIONS.acceptConfirm}
              </Button>
            )}
          </>
        }
      >
        {confirm === 'declined' ? ACTIONS.declineBody : ACTIONS.acceptBody}
      </Modal>
    </>
  );
}
