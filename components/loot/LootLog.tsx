'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';
import { DualTime } from '@/components/time/DualTime';
import { Button, Choice, Field, Input, Modal, useToast } from '@/components/ui';
import { CONTROL } from '@/components/ui/Field';
import { SAVE_FAILED } from '@/content/calendar';
import { LOOT_LOG, METHOD_LABEL } from '@/content/loot-log';
import { cn } from '@/lib/cn';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import type { AwardView, Candidate, LootTableView, ReserveView } from '@/lib/loot-data';
import { mergeAwards, type LocalAward, type LoggedAward, type LoggedHr } from '@/lib/loot-log-state';
import { defaultMethodFor, LOOT_METHODS, resolveDrop, type LootMethod } from '@/lib/loot-rules';
import { ItemName } from './ItemName';

type Props = {
  raidId: string;
  table: LootTableView;
  reserves: ReserveView[];
  candidates: Candidate[];
  raidAwards: LoggedAward[];
  hrAwards: LoggedHr[];
  awards: AwardView[];
};

async function send(url: string, method: string, body: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, json: {} };
  }
}

const select = cn(CONTROL, 'h-[46px] px-3');

/** Raid detail § Loot log (officers): boss → item → who may roll → record the winner. */
export function LootLog({ raidId, table, reserves, candidates, raidAwards, hrAwards, awards }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [bossId, setBossId] = useState(table.bosses[0]?.id ?? '');
  const [itemId, setItemId] = useState<number | null>(null);
  const [winner, setWinner] = useState('');
  const [method, setMethod] = useState<LootMethod>('MAIN_SPEC');
  const [roll, setRoll] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState<AwardView | null>(null);
  const [reason, setReason] = useState('');
  // Records saved here that the server props do not show yet: the next drop resolves
  // against them straight away instead of waiting for the refresh.
  const [pending, setPending] = useState<LocalAward[]>([]);
  const [voidedHere, setVoidedHere] = useState<ReadonlySet<string>>(new Set());
  const merged = mergeAwards(raidAwards, hrAwards, pending, voidedHere);
  const given = merged.raidAwards;
  const hrGiven = merged.hrAwards;

  const boss = table.bosses.find((b) => b.id === bossId);
  const characters = useMemo(() => new Map(candidates.flatMap((c) => c.characters.map((ch) => [ch.id, { ...ch, owner: c.name, userId: c.userId }] as const))), [candidates]);
  const resolution = itemId === null ? null : resolveDrop(itemId, reserves, given, hrGiven);

  function pickItem(id: number | null) {
    setItemId(id);
    setWinner('');
    setRoll('');
    setNote('');
    if (id !== null) {
      const next = resolveDrop(id, reserves, given, hrGiven);
      setMethod(defaultMethodFor(next.mode));
      // One reserve holder: they are the winner unless the officer says otherwise.
      if (next.contenders.length === 1) setWinner(next.contenders[0].characterId);
    }
  }

  async function record(e: FormEvent | null, disenchant = false) {
    e?.preventDefault();
    if (busy || itemId === null) return;
    setBusy(true);
    const r = await send(`/api/raids/${raidId}/loot`, 'POST', { bossId: bossId || null, itemId, characterId: disenchant ? null : winner, method: disenchant ? 'DISENCHANT_BANK' : method, roll: disenchant ? null : roll, note });
    setBusy(false);
    const itemName = table.items[itemId]?.name ?? `#${itemId}`;
    if (!r.ok) {
      toast({ tone: 'stop', title: typeof r.json.error === 'string' ? r.json.error : SAVE_FAILED });
      return;
    }
    const who = characters.get(winner);
    if (typeof r.json.id === 'string') {
      const id = r.json.id;
      setPending((p) => [...p, { id, itemId, userId: disenchant ? null : (who?.userId ?? null), characterId: disenchant ? null : winner, method: disenchant ? 'DISENCHANT_BANK' : method }]);
    }
    toast({ tone: 'ok', title: disenchant ? LOOT_LOG.banked(itemName) : LOOT_LOG.recorded(itemName, who ? `${who.owner} (${who.name})` : '') });
    pickItem(null);
    router.refresh();
  }

  async function voidAward() {
    if (!voiding || busy) return;
    setBusy(true);
    const r = await send(`/api/raids/${raidId}/loot/${voiding.id}`, 'PATCH', { reason });
    setBusy(false);
    toast(r.ok ? { tone: 'ok', title: LOOT_LOG.voided } : { tone: 'stop', title: typeof r.json.error === 'string' ? r.json.error : SAVE_FAILED });
    if (r.ok) {
      const id = voiding.id;
      setVoidedHere((v) => new Set(v).add(id));
      setVoiding(null);
      setReason('');
      router.refresh();
    }
  }

  const contenderIds = new Set(resolution?.contenders.map((c) => c.characterId) ?? []);
  return (
    <section className="flex flex-col gap-5 rounded-card border border-line bg-ink-850 p-4 md:p-5" aria-labelledby="loot-log-heading">
      <div className="flex flex-col gap-2">
        <h2 id="loot-log-heading" className="font-display text-2xl font-medium">
          {LOOT_LOG.heading}
        </h2>
        <p className="max-w-[720px] text-sm text-fg-2">{LOOT_LOG.lede}</p>
      </div>

      <form onSubmit={(e) => record(e)} className="flex flex-col gap-4 rounded-card border border-line-faint bg-ink-900 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={LOOT_LOG.boss}>
            <select className={select} value={bossId} onChange={(e) => {
                setBossId(e.target.value);
                pickItem(null);
              }}>
              {table.bosses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={LOOT_LOG.item}>
            <select className={select} value={itemId ?? ''} onChange={(e) => pickItem(e.target.value ? Number(e.target.value) : null)}>
              <option value="">{LOOT_LOG.pickItem}</option>
              {boss?.itemIds.map((id) => (
                <option key={id} value={id}>
                  {table.items[id]?.name ?? `#${id}`}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {itemId !== null && resolution && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <ItemName item={table.items[itemId]} />
              <span className={cn('text-sm font-semibold', resolution.mode === 'HR' ? 'text-sand' : resolution.mode === 'SR' ? 'text-teal' : 'text-fg-2')}>{LOOT_LOG.mode[resolution.mode]}</span>
            </div>
            {resolution.contenders.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-fg-2">{LOOT_LOG.contenders}</legend>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {resolution.contenders.map((c) => {
                    const ch = characters.get(c.characterId);
                    return (
                      <Choice
                        key={c.characterId}
                        type="radio"
                        name="contender"
                        card
                        checked={winner === c.characterId}
                        onChange={() => setWinner(c.characterId)}
                        label={`${ch?.owner ?? '?'} · ${ch?.name ?? '?'} (${c.kind})`}
                      />
                    );
                  })}
                </div>
              </fieldset>
            )}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label={LOOT_LOG.winner} hint={winner && resolution.mode !== 'OPEN' && !contenderIds.has(winner) ? LOOT_LOG.notContender(resolution.mode) : undefined}>
                <select className={select} value={winner} onChange={(e) => setWinner(e.target.value)} required>
                  <option value="">{LOOT_LOG.pickWinner}</option>
                  {candidates.map((c) => (
                    <optgroup key={c.userId} label={c.name}>
                      {c.characters.map((ch) => (
                        <option key={ch.id} value={ch.id}>
                          {ch.name} · {CLASS_COLORS[ch.wowClass].label}
                          {contenderIds.has(ch.id) ? ` (${resolution.mode})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Field>
              <Field label={LOOT_LOG.roll}>
                <Input type="number" inputMode="numeric" min={1} max={100} value={roll} onChange={(e) => setRoll(e.target.value)} />
              </Field>
              <Field label={LOOT_LOG.method}>
                <select className={select} value={method} onChange={(e) => setMethod(e.target.value as LootMethod)}>
                  {LOOT_METHODS.filter((m) => m !== 'DISENCHANT_BANK').map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={LOOT_LOG.note}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Button variant="secondary" disabled={busy} onClick={() => record(null, true)}>
                {LOOT_LOG.disenchant}
              </Button>
              <Button type="submit" loading={busy} disabled={!winner}>
                {LOOT_LOG.record}
              </Button>
            </div>
          </>
        )}
        {candidates.length === 0 && <p className="text-sm text-fg-3">{LOOT_LOG.noCharacters}</p>}
      </form>

      <div className="flex flex-col gap-2">
        <h3 className="text-label font-semibold uppercase tracking-[0.12em] text-fg-3">{LOOT_LOG.listHeading}</h3>
        {awards.length === 0 ? (
          <p className="text-sm text-fg-3">{LOOT_LOG.listEmpty}</p>
        ) : (
          <ul className="divide-y divide-line-faint rounded-card border border-line-faint">
            {awards.map((a) => (
              <AwardRow key={a.id} award={a} table={table} onVoid={() => setVoiding(a)} />
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title={LOOT_LOG.voidTitle}
        actions={
          <>
            <Button variant="ghost" onClick={() => setVoiding(null)}>
              {LOOT_LOG.cancel}
            </Button>
            <Button variant="danger" loading={busy} onClick={voidAward}>
              {LOOT_LOG.voidConfirm}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p>{LOOT_LOG.voidBody}</p>
          <Field label={LOOT_LOG.voidReason}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
          </Field>
        </div>
      </Modal>
    </section>
  );
}

/** One loot record. Shared with the member view, which passes no `onVoid`. */
export function AwardRow({ award, table, onVoid }: { award: AwardView; table: LootTableView; onVoid?: () => void }) {
  const item = table.items[award.itemId];
  const voided = award.voidedAt !== null;
  return (
    <li className={cn('grid gap-x-4 gap-y-1 px-3 py-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center', voided && 'opacity-60')}>
      <span className={cn('flex min-w-0 flex-col', voided && 'line-through')}>
        {item ? <ItemName item={item} /> : <span className="text-sm">#{award.itemId}</span>}
        <span className="text-xs text-fg-3">{award.bossName ?? ''}</span>
      </span>
      <span className="text-sm">
        {award.winner ? (
          <>
            {award.winner.name ?? award.winner.characterName}{' '}
            <span className="text-fg-3">
              (<span style={award.winner.wowClass ? { color: CLASS_COLORS[award.winner.wowClass].onInk } : undefined}>{award.winner.characterName}</span>)
            </span>
          </>
        ) : (
          <span className="text-fg-3">{METHOD_LABEL.DISENCHANT_BANK}</span>
        )}
      </span>
      <span className="flex flex-col text-sm">
        <span>
          {METHOD_LABEL[award.method]}
          {award.roll !== null && <span className="tabular text-fg-3"> · {award.roll}</span>}
          {voided && <span className="ml-2 font-semibold text-stop">{LOOT_LOG.voidedLabel}</span>}
        </span>
        <span className="text-xs text-fg-3">
          <DualTime startsAt={award.createdAt} durationMin={0} className="text-xs" />
          {award.recordedBy && ` · ${LOOT_LOG.by(award.recordedBy)}`}
        </span>
        {(award.note || award.voidReason) && <span className="text-xs text-fg-2">{[award.note, award.voidReason].filter(Boolean).join(' · ')}</span>}
      </span>
      {onVoid && !voided ? (
        <Button variant="ghost" size="sm" className="justify-self-start text-stop md:justify-self-auto" onClick={onVoid} aria-label={`${LOOT_LOG.void}: ${item?.name ?? award.itemId}`}>
          {LOOT_LOG.void}
        </Button>
      ) : (
        <span />
      )}
    </li>
  );
}
