'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, FIELD_LABEL, Modal, ProgressTrack, Tag, Toast, useToast, type ToastData } from '@/components/ui';
import { LOOT_LOAD } from '@/content/loot-admin';
import { cn } from '@/lib/cn';
import {
  applyLoadTable,
  LOAD_TABLE_MESSAGES,
  previewLoadTable,
  readLoadFile,
  type LoadFile,
  type PreviewItem,
  type PreviewResult,
} from '@/lib/loot-load-client';
import { ItemLabel } from './ItemName';

type Ready = Extract<PreviewResult, { kind: 'preview' }>;
type Phase = 'source' | 'fetching' | 'preview' | 'stale';

type Props = {
  open: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
  onLoaded: () => void;
};

/**
 * The "Load table" window (design #203, version A): choose a file, fetch its items from
 * Wowhead, preview the merge, confirm. The behaviour lives in lib/loot-load-client; this is
 * the screens. The native dialog sits in the top layer, so it carries its own toast.
 */
export function LoadTableWindow({ open, onClose, templateId, templateName, onLoaded }: Props) {
  const pageToast = useToast();
  const [loadFile, setLoadFile] = useState<LoadFile | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopped, setStopped] = useState(false);
  const [phase, setPhase] = useState<Phase>('source');
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [ready, setReady] = useState<Ready | null>(null);
  const [busy, setBusy] = useState<'apply' | 'retry' | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  // Each run gets a number; closing, Stop or a newer run makes an older answer stale.
  const run = useRef(0);
  const stopRequested = useRef(false);
  // Saving can't be called back, so the window stays open until its answer arrives.
  const applying = useRef(false);
  const body = useRef<HTMLDivElement>(null);
  // The step last shown, so a change of step (not opening the window) moves focus into the new step.
  const shownStep = useRef<string | null>(null);

  function close() {
    if (applying.current) return;
    run.current++;
    stopRequested.current = true;
    setLoadFile(null);
    setFileName(null);
    setError(null);
    setStopped(false);
    setPhase('source');
    setReady(null);
    setBusy(null);
    setToast(null);
    onClose();
  }

  async function chooseFile(file: File) {
    const id = ++run.current;
    setError(null);
    setStopped(false);
    setLoadFile(null);
    setFileName(file.name);
    const result = await readLoadFile(file);
    if (id !== run.current) return;
    if (result.ok) setLoadFile(result.value);
    else setError(result.error);
  }

  /** From step 1 (or stale): show fetching. A retry from the preview keeps the preview on screen. */
  async function startPreview(retry = false) {
    if (!loadFile) return;
    const id = ++run.current;
    stopRequested.current = false;
    setError(null);
    setStopped(false);
    setToast(null);
    if (retry) setBusy('retry');
    else {
      setPhase('fetching');
      setProgress({ completed: 0, total: loadFile.total });
    }
    const result = await previewLoadTable({
      templateId,
      loadFile,
      stopped: () => stopRequested.current || id !== run.current,
      onProgress: (next) => id === run.current && setProgress(next),
    });
    if (id !== run.current || result.kind === 'stopped') return;
    setBusy(null);
    if (result.kind === 'error') {
      if (retry) setToast({ tone: 'stop', title: result.error });
      else {
        setPhase('source');
        setError(result.error);
      }
      return;
    }
    if (retry && ready && result.failed.length > 0 && sameIds(ready.failed, result.failed)) {
      setToast({ tone: 'ok', title: LOOT_LOAD.stillMissing(result.failed.length) });
    }
    setReady(result);
    setPhase('preview');
  }

  /** Back to step 1 at once; the batch in flight finishes on the server and its items stay cached. */
  function stop() {
    run.current++;
    stopRequested.current = true;
    setPhase('source');
    setStopped(true);
  }

  async function apply() {
    if (!loadFile || !ready) return;
    if (applying.current) return;
    applying.current = true;
    setBusy('apply');
    setToast(null);
    const result = await applyLoadTable({ templateId, loadFile, token: ready.preview.token });
    applying.current = false;
    setBusy(null);
    if (result.kind === 'success') {
      const name = loadFile.name;
      close();
      pageToast({ tone: 'ok', title: LOOT_LOAD.loaded(name, result.added) });
      onLoaded();
    } else if (result.kind === 'stale') setPhase('stale');
    // A server sentence can't be fixed by sending the same thing again, so it has no Retry.
    else if (result.kind === 'error') setToast({ tone: 'stop', title: result.error });
    else setToast({ tone: 'stop', title: LOAD_TABLE_MESSAGES.SAVE_FAILED, action: { label: LOOT_LOAD.retry, onClick: () => void apply() } });
  }

  const nothing = phase === 'preview' && ready?.nothingToChange;
  const step = `${phase}${nothing ? '-nothing' : ''}${stopped ? '-stopped' : ''}`;
  useEffect(() => {
    if (!open) {
      shownStep.current = null;
      return;
    }
    // The button that had focus may have left with the old step; the dialog would drop focus to the page.
    if (shownStep.current !== null && shownStep.current !== step) {
      body.current?.closest('dialog')?.querySelector<HTMLElement>('[data-step-focus]')?.focus();
    }
    shownStep.current = step;
  }, [open, step]);
  const actions = phase === 'fetching' ? (
    <Foot note={LOOT_LOAD.reading(loadFile?.name ?? '')}>
      <Button variant="secondary" data-step-focus onClick={stop}>{LOOT_LOAD.stop}</Button>
    </Foot>
  ) : nothing ? (
    <Foot><Button onClick={close}>{LOOT_LOAD.close}</Button></Foot>
  ) : phase === 'stale' ? (
    <Foot note={LOOT_LOAD.from(loadFile?.name ?? '')}>
      <Button variant="ghost" onClick={close}>{LOOT_LOAD.cancel}</Button>
      <Button onClick={() => void startPreview()}>{LOOT_LOAD.previewAgain}</Button>
    </Foot>
  ) : phase === 'preview' && ready ? (
    <Foot note={LOOT_LOAD.from(loadFile?.name ?? '')}>
      <Button variant="ghost" disabled={busy !== null} onClick={() => setPhase('source')}>{LOOT_LOAD.back}</Button>
      <Button loading={busy === 'apply'} disabled={busy === 'retry'} onClick={() => void apply()}>{LOOT_LOAD.load(ready.preview.added)}</Button>
    </Foot>
  ) : (
    <Foot note={LOOT_LOAD.confirmHint}>
      <Button variant="ghost" onClick={close}>{LOOT_LOAD.cancel}</Button>
      <Button disabled={!loadFile} onClick={() => void startPreview()}>{LOOT_LOAD.preview}</Button>
    </Foot>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={LOOT_LOAD.title}
      wide
      eyebrow={<span className="font-eyebrow text-[11px] font-semibold uppercase tracking-[0.28em] text-sand">{templateName}</span>}
      actions={actions}
    >
      <div ref={body}>
      {phase === 'fetching' ? (
        <Fetching {...progress} />
      ) : nothing ? (
        <div role="status" tabIndex={-1} data-step-focus className="flex flex-col gap-1.5 rounded-card border border-dashed border-line-strong p-5 text-center outline-none">
          <strong className="font-display text-xl font-medium text-fg">{LOOT_LOAD.nothingTitle}</strong>
          <span>{LOOT_LOAD.nothingBody}</span>
        </div>
      ) : (phase === 'preview' || phase === 'stale') && ready && loadFile ? (
        <PreviewView ready={ready} loadFile={loadFile} stale={phase === 'stale'} busy={busy} onRetry={() => void startPreview(true)} />
      ) : (
        <SourceStep fileName={fileName} error={error} stopped={stopped} onChoose={chooseFile} />
      )}
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </Modal>
  );
}

/** The window's foot: a note on the left, buttons on the right; on phones full-width buttons, the real action on top. */
function Foot({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <div className="flex w-full flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end max-sm:[&>button]:w-full">
      {note && <span className="text-center text-[13px] text-fg-3 sm:mr-auto sm:text-left">{note}</span>}
      {children}
    </div>
  );
}

function SourceStep({ fileName, error, stopped, onChoose }: { fileName: string | null; error: string | null; stopped: boolean; onChoose: (file: File) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-[22px]">
      {stopped && (
        <div role="status" className="flex flex-col gap-1.5 rounded-card border border-teal-line bg-teal-wash px-3.5 py-3 text-teal-text">
          <strong className="font-semibold text-fg">{LOOT_LOAD.stoppedTitle}</strong>
          <span>{LOOT_LOAD.stoppedBody}</span>
        </div>
      )}
      <div>
        <span id={`${id}-label`} className={cn(FIELD_LABEL, 'mb-2 block')}>{LOOT_LOAD.fileLabel}</span>
        {/* The whole field is the button's target: the drawn button alone is under 44px. */}
        <div className={cn('relative flex min-h-[46px] items-center gap-3 rounded-control border px-1.5 text-[15px] text-fg', error ? 'border-stop bg-stop-wash' : 'border-line-strong bg-ink-700')}>
          <button
            type="button"
            data-step-focus
            onClick={() => input.current?.click()}
            aria-describedby={`${id}-label ${id}-name ${id}-note`}
            className="min-h-[34px] shrink-0 rounded-control border border-line-strong bg-ink-800 px-3 text-[13px] font-semibold text-fg after:absolute after:inset-0"
          >
            {LOOT_LOAD.chooseFile}
          </button>
          <span id={`${id}-name`} className={cn('min-w-0 truncate', !fileName && 'text-fg-3')}>{fileName ?? LOOT_LOAD.noFile}</span>
        </div>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so choosing the same file again (after fixing it) still reads it.
            event.target.value = '';
            if (file) onChoose(file);
          }}
        />
        {/* A fresh element for the error, so screen readers announce it. */}
        {error ? (
          <span key="error" id={`${id}-note`} role="alert" className="mt-2 block text-xs text-stop">{error}</span>
        ) : (
          <span key="hint" id={`${id}-note`} className="mt-2 block text-xs text-fg-3">{LOOT_LOAD.fileHint}</span>
        )}
      </div>
    </div>
  );
}

function Fetching({ completed, total }: { completed: number; total: number }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5 pb-1 pt-2">
      <strong id={id} className="text-[15px] font-semibold text-fg">
        {LOOT_LOAD.fetching} <span className="tabular">{LOOT_LOAD.fetchCount(completed, total)}</span>
      </strong>
      <ProgressTrack variant="fetch" value={completed} max={total} label={`${LOOT_LOAD.fetching} ${LOOT_LOAD.fetchCount(completed, total)}`} />
      <span>{LOOT_LOAD.timeLeft(total - completed)} {LOOT_LOAD.fetchingHint}</span>
    </div>
  );
}

function PreviewView({ ready, loadFile, stale, busy, onRetry }: { ready: Ready; loadFile: LoadFile; stale: boolean; busy: 'apply' | 'retry' | null; onRetry: () => void }) {
  const { preview, items, failed } = ready;
  // Kill order is the file's order; bosses already on the table but not in the file aren't part of this load.
  const byName = new Map(preview.bosses.map((boss) => [boss.name, boss]));
  const bosses = loadFile.file.bosses.flatMap((boss) => byName.get(boss.name) ?? []);
  const views = new Map<number, PreviewItem>(items.map((item) => [item.id, item]));
  const missing = bosses.filter((boss) => boss.notFound.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {stale && (
        <div role="alert" tabIndex={-1} data-step-focus className="flex flex-col gap-1.5 rounded-card border border-warn-line bg-warn-wash px-3.5 py-3 text-fg outline-none">
          <strong className="font-semibold text-warn">{LOAD_TABLE_MESSAGES.STALE}</strong>
          <span>{LOAD_TABLE_MESSAGES.STALE_HINT}</span>
        </div>
      )}
      <p tabIndex={-1} data-step-focus={stale ? undefined : true} className="text-[15px] text-fg outline-none">
        {LOOT_LOAD.summaryAdds} <b className="font-semibold">{LOOT_LOAD.summaryItems(preview.added)}</b>
        {LOOT_LOAD.summaryRest(preview.newBosses, bosses.filter((boss) => !boss.isNew).length)}
      </p>
      {failed.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-card border border-warn-line bg-warn-wash px-3.5 py-3 text-fg">
          <strong className="font-semibold text-warn">{LOOT_LOAD.notFound(failed.length)}</strong>
          <span>{LOOT_LOAD.notFoundHint}</span>
          {missing.map((boss) => (
            <span key={boss.name} className="tabular text-fg-2">{boss.name}: {boss.notFound.map((id) => `#${id}`).join(', ')}</span>
          ))}
          <span><Button variant="secondary" size="sm" loading={busy === 'retry'} disabled={busy === 'apply'} onClick={onRetry}>{LOOT_LOAD.tryAgain}</Button></span>
        </div>
      )}
      <section>
        <h3 className={cn(FIELD_LABEL, 'border-b border-line pb-1.5')}>{LOOT_LOAD.adds}</h3>
        {bosses.map((boss) => (
          <div key={boss.name} className="flex flex-col gap-1.5 border-t border-line py-3.5 first-of-type:border-t-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h4 className="font-display text-xl font-medium text-fg">{boss.name}</h4>
              {boss.isNew && <Tag className="self-center">{LOOT_LOAD.newBoss}</Tag>}
              {boss.isTrash && <Tag className="self-center">{LOOT_LOAD.trash}</Tag>}
              <span className="tabular text-[13px] text-fg-3">{LOOT_LOAD.counts(boss.add.length, boss.already.length, boss.notFound.length)}</span>
            </div>
            {boss.add.length > 0 && (
              <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {boss.add.map((id) => {
                  const item = views.get(id);
                  return (
                    <li key={id} className="flex min-h-[30px] min-w-0 items-center gap-2">
                      {item && <ItemLabel item={item} />}
                      <span className="tabular ml-auto pl-2 text-xs text-fg-3">#{id}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

function sameIds(left: { id: number }[], right: { id: number }[]) {
  const ids = new Set(left.map((item) => item.id));
  return left.length === right.length && right.every((item) => ids.has(item.id));
}
