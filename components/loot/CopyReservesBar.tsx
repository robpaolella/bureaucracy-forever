'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, useToast } from '@/components/ui';
import { CONTROL } from '@/components/ui/Field';
import { LOOT_LOG } from '@/content/loot-log';

const copy = LOOT_LOG.addon;

type Status = { kind: 'copied'; part: number; parts: number } | { kind: 'blocked'; text: string } | null;

/**
 * The Loot add-on bar at the top of the officers' Loot log: Copy reserves puts the raid's
 * snapshot on the clipboard for the add-on's Sync tab. A snapshot in several parts is copied
 * one part per press, all from the one fetch; the press after the last part starts over.
 * `children` are further actions beside Copy (the award import joins them).
 */
export function CopyReservesBar({ raidId, reserves, awards, children }: { raidId: string; reserves: number; awards: number; children?: ReactNode }) {
  const toast = useToast();
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const run = useRef<{ parts: string[]; next: number } | null>(null);
  const blockedBox = useRef<HTMLTextAreaElement>(null);

  // The refused text is shown already selected, ready to copy by hand.
  useEffect(() => {
    if (status?.kind === 'blocked') {
      blockedBox.current?.focus({ preventScroll: true });
      blockedBox.current?.select();
    }
  }, [status]);

  async function press() {
    if (busy) return;
    setBusy(true);
    try {
      if (!run.current) {
        let parts: unknown;
        try {
          const res = await fetch(`/api/raids/${raidId}/snapshot`, { credentials: 'same-origin' });
          parts = res.ok ? ((await res.json()) as { parts?: unknown }).parts : null;
        } catch {
          parts = null;
        }
        if (!Array.isArray(parts) || parts.length === 0 || !parts.every((p) => typeof p === 'string')) {
          toast({ tone: 'stop', title: copy.fetchFailed });
          return;
        }
        run.current = { parts: parts as string[], next: 0 };
      }
      const { parts, next } = run.current;
      const text = parts[next];
      // The run moves on whether or not the browser let us copy: a blocked part is copied by hand.
      run.current = next + 1 < parts.length ? { parts, next: next + 1 } : null;
      try {
        await navigator.clipboard.writeText(text);
        setStatus({ kind: 'copied', part: next + 1, parts: parts.length });
      } catch {
        setStatus({ kind: 'blocked', text });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line-faint bg-ink-900 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{copy.heading}</h3>
          <p className="text-sm text-fg-2">{reserves === 0 ? copy.noReserves : copy.includes(reserves, awards)}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="secondary" size="sm" loading={busy} onClick={press}>
            {copy.copy}
          </Button>
          {children}
        </div>
      </div>
      {status?.kind === 'blocked' ? (
        <div role="status" className="flex flex-col gap-2">
          <label htmlFor="copy-reserves-text" className="text-sm text-warn">
            {copy.blocked}
          </label>
          <textarea id="copy-reserves-text" ref={blockedBox} readOnly rows={6} value={status.text} className={`${CONTROL} resize-y px-3.5 py-3 font-mono leading-relaxed`} />
        </div>
      ) : (
        <p role="status" className={status ? 'text-sm text-ok' : 'sr-only'}>
          {status?.kind === 'copied' ? (status.parts === 1 ? copy.copied : copy.copiedPart(status.part, status.parts)) : ''}
        </p>
      )}
    </div>
  );
}
