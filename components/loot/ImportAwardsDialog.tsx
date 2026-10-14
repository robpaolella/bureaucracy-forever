'use client';

import { useCallback, useId, useState } from 'react';
import { Button, Field, Modal, StatusPill, Textarea, Toast, type StatusTone, type ToastData } from '@/components/ui';
import { LOOT_LOG } from '@/content/loot-log';
import { itemQuality } from '@/lib/design/item-quality';
import { nothingNew, readImportResponse, type ImportedAward, type ImportOutcome, type ImportSummary } from '@/lib/import-results';
import type { ItemView } from '@/lib/loot-items';

const copy = LOOT_LOG.import;

type Props = {
  open: boolean;
  onClose: () => void;
  raidId: string;
  /** The raid's table items, to name an award's item; others read "Item 123". */
  items: Record<number, ItemView>;
  /** This site is the staging one, so "the other site" is production. */
  staging: boolean;
  /** Something was recorded or voided: the loot log behind the window needs the new rows. */
  onChanged: () => void;
};

/**
 * The "Import awards" window (design #272, version A): paste the add-on's copy-out text,
 * import it through the officer endpoint, and read what happened to each award. The text
 * stays in the box through a refusal or a failure, so it can be fixed or sent again.
 */
export function ImportAwardsDialog({ open, onClose, raidId, items, staging, onChanged }: Props) {
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  function close() {
    if (busy) return;
    setText('');
    setOutcome(null);
    setToast(null);
    onClose();
  }

  async function submit() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setToast(null);
    let result: ImportOutcome;
    try {
      const res = await fetch(`/api/raids/${raidId}/loot/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ text }) });
      result = readImportResponse(res.status, await res.json().catch(() => null));
    } catch {
      result = { kind: 'failed' };
    }
    setBusy(false);
    if (result.kind === 'failed') {
      setOutcome(null);
      setToast({ tone: 'stop', title: copy.failedTitle, detail: copy.failedDetail });
      return;
    }
    setOutcome(result);
    if (result.kind === 'results' && (result.summary.recorded > 0 || result.summary.voided > 0)) onChanged();
  }

  const summary = outcome?.kind === 'results' ? outcome.summary : null;
  const unreadable = outcome?.kind === 'unreadable' ? unreadableMessage(outcome, staging) : null;
  const actions = summary ? (
    <>
      <Button variant="ghost" onClick={() => { setText(''); setOutcome(null); }}>{copy.more}</Button>
      <Button onClick={close}>{copy.done}</Button>
    </>
  ) : (
    <>
      <Button variant="ghost" disabled={busy} onClick={close}>{copy.cancel}</Button>
      <Button loading={busy} disabled={!text.trim()} onClick={() => void submit()}>{busy ? copy.importing : copy.submit}</Button>
    </>
  );

  return (
    <Modal open={open} onClose={close} title={copy.title} actions={actions}>
      {summary ? (
        <Results summary={summary} items={items} />
      ) : (
        <div className="flex flex-col gap-4 pb-1">
          <p>{copy.intro}</p>
          <Field label={copy.label} hint={copy.hint} error={unreadable ? <span role="alert">{unreadable}</span> : undefined} id={`${id}-paste`}>
            <Textarea
              rows={7}
              placeholder={copy.placeholder}
              value={text}
              disabled={busy}
              onChange={(event) => { setText(event.target.value); setOutcome(null); }}
              className="font-mono"
            />
          </Field>
        </div>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </Modal>
  );
}

function unreadableMessage(outcome: Extract<ImportOutcome, { kind: 'unreadable' }>, staging: boolean) {
  if (outcome.code === 'wrong-raid') return copy.wrongRaid;
  if (outcome.code === 'wrong-environment') return copy.otherSite(staging ? 'production' : 'staging');
  if (outcome.code === 'malformed-line' && outcome.line !== undefined) return copy.unreadableLine(outcome.line);
  return copy.unreadable;
}

const ROWS: { key: 'recorded' | 'replayed' | 'voided' | 'refused' | 'unknown' | 'waiting'; tone: StatusTone; note?: string }[] = [
  { key: 'recorded', tone: 'ok' },
  { key: 'replayed', tone: 'closed', note: copy.replayedNote },
  { key: 'voided', tone: 'closed' },
  { key: 'refused', tone: 'stop' },
  { key: 'unknown', tone: 'warn' },
  { key: 'waiting', tone: 'warn', note: copy.waitingNote },
];

function Results({ summary, items }: { summary: ImportSummary; items: Record<number, ItemView> }) {
  if (summary.total === 0 || nothingNew(summary)) {
    return (
      <div role="status" className="flex flex-col gap-1 rounded-card border border-line bg-ink-900 p-4">
        <p className="text-[15px] font-semibold text-fg">{summary.total === 0 ? copy.empty : copy.nothingNew(summary.total)}</p>
      </div>
    );
  }
  const counts = { ...summary, refused: summary.refused.length, unknown: summary.unknown.length };
  return (
    <div role="status" className="flex flex-col gap-3 rounded-card border border-line bg-ink-900 p-4">
      <p className="text-[15px] font-semibold text-fg">{copy.imported(summary.total)}</p>
      <ul className="divide-y divide-line-faint rounded-card border border-line-faint">
        {ROWS.map(({ key, tone, note }) => (
          <li key={key} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <StatusPill tone={tone}>{copy.counts[key]}</StatusPill>
              {note && counts[key] > 0 && <span className="text-xs text-fg-3">{note}</span>}
            </span>
            <span className="tabular text-sm font-semibold text-fg">{counts[key]}</span>
          </li>
        ))}
      </ul>
      {summary.refused.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{copy.refusedHeading}</h4>
          <ul className="flex flex-col gap-1 text-sm text-fg-2">
            {summary.refused.map((r, i) => (
              <li key={i}><Award award={r} items={items} />: {copy.refusals[r.code] ?? copy.refusedOther}</li>
            ))}
          </ul>
        </section>
      )}
      {summary.unknown.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h4 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{copy.unknownHeading}</h4>
          <ul className="flex flex-col gap-1 text-sm text-fg-2">
            {summary.unknown.map((r, i) => <li key={i}><Award award={r} items={items} /></li>)}
          </ul>
          <p className="text-xs text-fg-3">{copy.unknownNote}</p>
        </section>
      )}
    </div>
  );
}

/** "Item · character", the item in its quality color. */
function Award({ award, items }: { award: ImportedAward; items: Record<number, ItemView> }) {
  const item = award.item === null ? undefined : items[award.item];
  const name = item?.name ?? (award.item === null ? copy.anAward : copy.itemFallback(award.item));
  return (
    <>
      <span className="font-semibold" style={item ? { color: itemQuality(item.quality).onInk } : undefined}>{name}</span>
      {award.character && <> · {award.character}</>}
    </>
  );
}
