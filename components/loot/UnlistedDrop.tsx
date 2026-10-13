'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { LOOT_LOG } from '@/content/loot-log';
import type { ItemView } from '@/lib/loot-items';
import { parseForeverItemRef } from '@/lib/loot-rules';
import { ItemName } from './ItemName';

export type OnTableBoss = { bossId: string; bossName: string };

type Status = { kind: 'idle' | 'looking' | 'not-forever' | 'down' } | { kind: 'not-found'; id: number } | { kind: 'found'; item: ItemView };

/** A pause after the last keystroke before the lookup runs, so a link being typed is not looked up half-written. */
export const LOOKUP_DELAY_MS = 350;
/** Text that is not a link yet may just be half-typed, so "not a Forever link" waits longer before it shows. */
export const INVALID_DELAY_MS = 1200;

type Props = {
  raidId: string;
  disabled: boolean;
  /** The boss the item will be added to, named in the "New to the table" line. */
  bossName: string;
  /** The looked-up item that is new to the table, or null when the box changes. */
  onFound: (item: ItemView | null) => void;
  /** The item is already on the tier's table: the log records it the usual way. */
  onOnTable: (item: ItemView, bosses: OnTableBoss[]) => void;
};

/** Loot log § an item that is not on the table: the Wowhead Forever link box and its automatic lookup. */
export function UnlistedDrop({ raidId, disabled, bossName, onFound, onOnTable }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  // Bumped by "Try again", which runs the same lookup once more.
  const [attempt, setAttempt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const hadFound = status.kind === 'found';
  // The callbacks come from the parent's render; the lookup effect must not restart when they change.
  const latest = useRef({ onFound, onOnTable });
  useEffect(() => {
    latest.current = { onFound, onOnTable };
  });

  useEffect(() => box.current?.querySelector('input')?.focus(), []);

  useEffect(() => {
    if (!text.trim()) return;
    const id = parseForeverItemRef(text);
    // Each run owns its answer: a later input cancels this one, so a slow reply for an earlier value is ignored.
    let current = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (id === null) return setStatus({ kind: 'not-forever' });
      setStatus({ kind: 'looking' });
      let json: { item?: ItemView; onTable?: OnTableBoss[]; code?: string } = {};
      let ok = false;
      try {
        const res = await fetch(`/api/raids/${raidId}/loot/lookup?item=${encodeURIComponent(text.trim())}`, { credentials: 'same-origin', signal: controller.signal });
        ok = res.ok;
        json = await res.json().catch(() => ({}));
      } catch {
        // Offline or aborted: shown as "couldn't reach Wowhead" unless a newer input replaced this one.
      }
      if (!current) return;
      if (ok && json.item) {
        const onTable = json.onTable ?? [];
        if (onTable.length > 0) return latest.current.onOnTable(json.item, onTable);
        setStatus({ kind: 'found', item: json.item });
        return latest.current.onFound(json.item);
      }
      setStatus(json.code === 'not-forever' ? { kind: 'not-forever' } : json.code === 'not-found' && id !== null ? { kind: 'not-found', id } : { kind: 'down' });
    }, id === null ? INVALID_DELAY_MS : LOOKUP_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, attempt, raidId]);

  function change(value: string) {
    setText(value);
    setStatus({ kind: 'idle' });
    if (hadFound) onFound(null);
  }

  const copy = LOOT_LOG.unlisted;
  const error =
    status.kind === 'not-forever' ? copy.notForever : status.kind === 'not-found' ? copy.notFound(status.id) : status.kind === 'down' ? copy.down : null;
  return (
    <>
      <div ref={box}>
        <Field
          label={copy.refLabel}
          hint={copy.refHint}
          error={
            error && (
              <span role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {error}
                {status.kind === 'down' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setStatus({ kind: 'looking' });
                      setAttempt((n) => n + 1);
                    }}
                  >
                    {copy.retry}
                  </Button>
                )}
              </span>
            )
          }
        >
          <Input value={text} onChange={(e) => change(e.target.value)} placeholder={copy.refPlaceholder} autoComplete="off" spellCheck={false} disabled={disabled} />
        </Field>
      </div>
      <div role="status">
        {status.kind === 'looking' && (
          <p className="flex min-h-5 items-center gap-2 text-sm text-fg-2">
            <span aria-hidden className="block size-[13px] animate-spin rounded-full border-2 border-current border-r-transparent" />
            {copy.looking}
          </p>
        )}
        {status.kind === 'found' && (
          <div className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <ItemName item={status.item} />
              <span className="tabular text-sm text-fg-3">#{status.item.id}</span>
            </span>
            <span className="text-[13px] text-fg-2">
              {copy.newBefore}
              <b className="font-semibold text-fg">{bossName}</b>
              {copy.newAfter}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
