'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, Choice, Field, Input, Modal, Select, Tag, ToastHost, useToast } from '@/components/ui';
import { SAVE_FAILED } from '@/content/calendar';
import { LOOT_EDIT, LOOT_RESERVES, LOOT_TABLE } from '@/content/loot-admin';
import type { ItemSource } from '@/lib/loot-rules';
import type { ItemView } from '@/lib/loot-items';
import { ItemName } from './ItemName';
import { ItemReservesDialog, type ReservesTarget } from './ItemReservesDialog';

export type EditorBoss = { id: string; name: string; isTrash: boolean; items: ItemView[] };
/** blockedIds: items switched off for reserves across this tier (LootReserveSetting). */
type Props = { templateId: string; bosses: EditorBoss[]; defaultSource: ItemSource; blockedIds: number[] };

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
  return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}
const errorOf = (json: Record<string, unknown>) => (typeof json.error === 'string' ? json.error : SAVE_FAILED);

/** /officers/loot/[templateId]: bosses in kill order, their items, and Wowhead refresh. */
export function LootTableEditor(props: Props) {
  return (
    <ToastHost>
      <Editor {...props} />
    </ToastHost>
  );
}

function Editor({ templateId, bosses, defaultSource, blockedIds }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<EditorBoss | null>(null);
  const [deleting, setDeleting] = useState<EditorBoss | null>(null);
  const [reserves, setReserves] = useState<ReservesTarget | null>(null);
  const blocked = new Set(blockedIds);
  const [busy, setBusy] = useState<string | null>(null);
  // A tier refresh in progress: where it started, how many are left, and ids that failed.
  const [round, setRound] = useState<{ round: string; remaining: number; skip: number[] } | null>(null);

  async function run(key: string, action: () => Promise<{ ok: boolean; json: Record<string, unknown> }>, done: (json: Record<string, unknown>) => string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    const r = await action();
    setBusy(null);
    toast(r.ok ? { tone: 'ok', title: done(r.json) } : { tone: 'stop', title: errorOf(r.json) });
    if (r.ok) router.refresh();
    return r.ok;
  }

  async function refreshBatch() {
    await run('refresh', () => send('/api/loot/items/refresh', 'POST', { templateId, round: round?.round, skip: round?.skip }), (json) => {
      const failed = (json.failed as { id: number }[]) ?? [];
      const remaining = Number(json.remaining ?? 0);
      setRound(remaining > 0 ? { round: String(json.round), remaining, skip: [...(round?.skip ?? []), ...failed.map((f) => f.id)] } : null);
      return LOOT_EDIT.refreshDone(Number(json.saved ?? 0), failed.length) + (failed.length ? ` ${LOOT_EDIT.failedIds(failed.map((f) => f.id))}` : '');
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 rounded-card border border-line bg-ink-900 p-4 md:flex-row md:items-end md:justify-between md:p-5">
        <AddBossForm busy={busy !== null} onAdd={(name, isTrash) => run('add-boss', () => send(`/api/loot/tables/${templateId}/bosses`, 'POST', { name, isTrash }), () => LOOT_EDIT.bossAdded(name))} />
        <div className="flex flex-col gap-1.5 md:items-end">
          <Button variant="secondary" size="sm" loading={busy === 'refresh'} onClick={refreshBatch}>
            {round ? LOOT_EDIT.refreshMore(round.remaining) : LOOT_EDIT.refreshAll}
          </Button>
          <span className="max-w-[320px] text-xs text-fg-3 md:text-right">{LOOT_EDIT.refreshAllHint}</span>
        </div>
      </section>

      {bosses.length === 0 && <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-sm text-fg-2">{LOOT_TABLE.empty}</p>}

      {bosses.map((boss, i) => (
        <section key={boss.id} className="flex flex-col gap-2" aria-labelledby={`boss-${boss.id}`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 id={`boss-${boss.id}`} className="font-display text-2xl font-medium">
              {boss.name}
            </h2>
            {boss.isTrash && <Tag>{LOOT_TABLE.trash}</Tag>}
            <span className="tabular text-[13px] text-fg-3">{boss.items.length}</span>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" iconOnly aria-label={LOOT_EDIT.moveUp(boss.name)} disabled={i === 0 || busy !== null} onClick={() => run(`up-${boss.id}`, () => send(`/api/loot/bosses/${boss.id}`, 'PATCH', { move: 'up' }), () => LOOT_EDIT.moved(boss.name))}>
                ↑
              </Button>
              <Button variant="ghost" iconOnly aria-label={LOOT_EDIT.moveDown(boss.name)} disabled={i === bosses.length - 1 || busy !== null} onClick={() => run(`down-${boss.id}`, () => send(`/api/loot/bosses/${boss.id}`, 'PATCH', { move: 'down' }), () => LOOT_EDIT.moved(boss.name))}>
                ↓
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setEditing(boss)} aria-label={`${LOOT_EDIT.edit} ${boss.name}`}>
                {LOOT_EDIT.edit}
              </Button>
              <Button variant="ghost" size="sm" className="text-stop" onClick={() => setDeleting(boss)} aria-label={`${LOOT_EDIT.delete} ${boss.name}`}>
                {LOOT_EDIT.delete}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-card border border-line bg-ink-900 px-4 py-2">
            {boss.items.length === 0 ? (
              <p className="py-2 text-sm text-fg-3">{LOOT_TABLE.noItems}</p>
            ) : (
              // Rows never wrap from 768px: one column up to 1279px, two from 1280px; the name truncates instead.
              <ul className="grid grid-cols-1 gap-x-6 xl:grid-cols-2">
                {boss.items.map((item) => (
                  <li key={item.id} className="flex min-w-0 flex-wrap items-center gap-x-1 border-line-faint max-md:border-t max-md:first:border-t-0 md:flex-nowrap">
                    {/* Phones: 26px = the 18px icon plus its 8px gap, so the tag and controls line up under the name. */}
                    <div className="flex min-w-0 flex-1 items-center max-md:basis-full max-md:flex-wrap">
                      <ItemName item={item} className="min-w-0 max-md:basis-full" />
                      {blocked.has(item.id) && <Tag className="shrink-0 whitespace-nowrap max-md:mb-1 max-md:ml-[26px] md:ml-1.5">{LOOT_RESERVES.blockedTag}</Tag>}
                    </div>
                    <div className="ml-auto flex shrink-0 items-center gap-1 max-md:ml-0 max-md:w-full max-md:pb-2 max-md:pl-[26px]">
                      <span className="tabular text-xs text-fg-3 max-md:mr-auto">{LOOT_TABLE.itemId(item.id)}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        // 32px to look, 44px to hit: the ::after (measured inside the 1px border) reaches the row's full height.
                        className="relative h-8 px-2.5 after:absolute after:inset-x-0 after:-inset-y-[7px]"
                        aria-label={LOOT_RESERVES.buttonLabel(item.name)}
                        aria-haspopup="dialog"
                        onClick={() => setReserves({ item, blocked: blocked.has(item.id), otherBosses: bosses.filter((b) => b.id !== boss.id && b.items.some((x) => x.id === item.id)).map((b) => b.name) })}
                      >
                        {LOOT_RESERVES.button}
                      </Button>
                      <Button variant="ghost" iconOnly aria-label={LOOT_EDIT.refreshItem(item.name)} disabled={busy !== null} loading={busy === `refresh-${item.id}`} onClick={() => run(`refresh-${item.id}`, () => send('/api/loot/items/refresh', 'POST', { itemId: item.id }), () => LOOT_EDIT.refreshed(item.name))}>
                        {busy === `refresh-${item.id}` ? null : '↻'}
                      </Button>
                      <Button variant="ghost" iconOnly className="text-stop" aria-label={LOOT_EDIT.remove(item.name, boss.name)} disabled={busy !== null} onClick={() => run(`remove-${boss.id}-${item.id}`, () => send(`/api/loot/bosses/${boss.id}/items/${item.id}`, 'DELETE'), () => LOOT_EDIT.removed(item.name))}>
                        ×
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <AddItemForm
              bossName={boss.name}
              defaultSource={defaultSource}
              busy={busy === `add-${boss.id}`}
              onAdd={(ref, source) => run(`add-${boss.id}`, () => send(`/api/loot/bosses/${boss.id}/items`, 'POST', { ref, source }), (json) => LOOT_EDIT.itemAdded(String(json.name ?? ref)))}
            />
          </div>
        </section>
      ))}

      <ItemReservesDialog templateId={templateId} target={reserves} onClose={() => setReserves(null)} />
      <BossModal
        boss={editing}
        onClose={() => setEditing(null)}
        onSave={async (name, isTrash) => {
          if (!editing) return;
          if (await run('edit', () => send(`/api/loot/bosses/${editing.id}`, 'PATCH', { name, isTrash }), () => LOOT_EDIT.saved)) setEditing(null);
        }}
        busy={busy === 'edit'}
      />
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={deleting ? LOOT_EDIT.deleteTitle(deleting.name) : ''}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {LOOT_EDIT.cancel}
            </Button>
            <Button
              variant="danger"
              loading={busy === 'delete'}
              onClick={async () => {
                if (!deleting) return;
                const name = deleting.name;
                if (await run('delete', () => send(`/api/loot/bosses/${deleting.id}`, 'DELETE'), () => LOOT_EDIT.deleted(name))) setDeleting(null);
              }}
            >
              {LOOT_EDIT.deleteConfirm}
            </Button>
          </>
        }
      >
        {LOOT_EDIT.deleteBody}
      </Modal>
    </div>
  );
}

function AddBossForm({ busy, onAdd }: { busy: boolean; onAdd: (name: string, isTrash: boolean) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [trash, setTrash] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onAdd(name.trim(), trash)) {
      setName('');
      setTrash(false);
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 md:flex-row md:items-end md:gap-4">
      <Field label={LOOT_EDIT.bossName} className="md:w-64">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </Field>
      <Choice type="checkbox" label={LOOT_EDIT.trashLabel} checked={trash} onChange={(e) => setTrash(e.target.checked)} className="items-center" />
      <Button type="submit" variant="secondary" size="sm" disabled={busy || !name.trim()}>
        {LOOT_EDIT.addBoss}
      </Button>
    </form>
  );
}

function AddItemForm({ bossName, defaultSource, busy, onAdd }: { bossName: string; defaultSource: ItemSource; busy: boolean; onAdd: (ref: string, source: ItemSource) => Promise<boolean> }) {
  const [ref, setRef] = useState('');
  const [source, setSource] = useState<ItemSource>(defaultSource);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await onAdd(ref.trim(), source)) setRef('');
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line-faint py-3" aria-label={`${LOOT_EDIT.addItem}: ${bossName}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
        <Field label={LOOT_EDIT.itemRef} className="md:flex-1">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} required inputMode="url" autoComplete="off" />
        </Field>
        <div className="md:w-44">
          <Select label={LOOT_EDIT.source} options={LOOT_EDIT.sources} value={source} onChange={(e) => setSource(e.target.value as ItemSource)} />
        </div>
        <Button type="submit" variant="secondary" size="sm" loading={busy} disabled={!ref.trim()}>
          {LOOT_EDIT.addItem}
        </Button>
      </div>
      <span className="text-xs text-fg-3">{LOOT_EDIT.itemRefHint}</span>
    </form>
  );
}

function BossModal({ boss, busy, onClose, onSave }: { boss: EditorBoss | null; busy: boolean; onClose: () => void; onSave: (name: string, isTrash: boolean) => void }) {
  return (
    <Modal open={boss !== null} onClose={onClose} title={LOOT_EDIT.editTitle}>
      {boss && <BossForm key={boss.id} boss={boss} busy={busy} onClose={onClose} onSave={onSave} />}
    </Modal>
  );
}

function BossForm({ boss, busy, onClose, onSave }: { boss: EditorBoss; busy: boolean; onClose: () => void; onSave: (name: string, isTrash: boolean) => void }) {
  const [name, setName] = useState(boss.name);
  const [trash, setTrash] = useState(boss.isTrash);
  return (
    <form
      className="flex flex-col gap-4 pb-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(name.trim(), trash);
      }}
    >
      <Field label={LOOT_EDIT.bossName}>
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </Field>
      <Choice type="checkbox" label={LOOT_EDIT.trashLabel} checked={trash} onChange={(e) => setTrash(e.target.checked)} />
      <div className="flex justify-end gap-2.5">
        <Button variant="ghost" onClick={onClose}>
          {LOOT_EDIT.cancel}
        </Button>
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          {LOOT_EDIT.save}
        </Button>
      </div>
    </form>
  );
}
