'use client';

import { useEffect, useState } from 'react';
import { ItemName } from '@/components/loot/ItemName';
import { RAID_LOOT } from '@/content/loot';
import { METHOD_LABEL } from '@/content/loot-log';
import { CLASS_COLORS } from '@/lib/design/class-colors';
import type { RaidLootView } from '@/lib/member-loot';

/** One bounded request at a time, only inside the live window. Failures retain the last list. */
export function pollRaidLoot(raidId: string, initial: RaidLootView, receive: (loot: RaidLootView | null) => void, failure: (failed: boolean) => void, ended: () => void) {
  const start = Date.parse(initial.startsAt), end = Date.parse(initial.endsAt);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  if (Date.now() < start || Date.now() >= end) return () => {};
  const endTimer = setTimeout(() => { controller.abort(); clearTimeout(timer); ended(); }, end - Date.now());
  async function refresh() {
    if (controller.signal.aborted || Date.now() < start || Date.now() >= end) return;
    try {
      const response = await fetch(`/members/calendar/${encodeURIComponent(raidId)}/loot`, {
        cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      if (controller.signal.aborted) return;
      if (response.redirected || [401, 403, 404].includes(response.status)) { receive(null); return; }
      if (!response.ok) throw new Error('refresh failed');
      const next: RaidLootView = await response.json();
      if (!controller.signal.aborted) { receive(next); failure(false); }
    } catch {
      if (!controller.signal.aborted) failure(true);
    }
    if (!controller.signal.aborted) timer = setTimeout(refresh, 30_000);
  }
  timer = setTimeout(refresh, 30_000);
  return () => { controller.abort(); clearTimeout(timer); clearTimeout(endTimer); };
}

export function RaidLoot({ raidId, initial }: { raidId: string; initial: RaidLootView }) {
  const [loot, setLoot] = useState<RaidLootView | null>(initial);
  const [failed, setFailed] = useState(false);
  const [previous, setPrevious] = useState(initial);
  if (previous !== initial) { setPrevious(initial); setLoot(initial); setFailed(false); }
  useEffect(() => pollRaidLoot(raidId, initial, setLoot, setFailed, () => {
    setLoot((current) => current && { ...current, live: false });
    setFailed(false);
  }), [raidId, initial]);
  return loot && <RaidLootList loot={loot} failed={failed} />;
}

const columns = 'md:grid md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] md:items-center md:gap-x-4 md:px-4';
const separator = "before:mx-2 before:text-fg-3 before:content-['·'] md:before:hidden";

export function RaidLootList({ loot, failed = false }: { loot: RaidLootView; failed?: boolean }) {
  return (
    <section id="raid-loot" aria-labelledby="raid-loot-heading" className="flex scroll-mt-24 flex-col gap-4 rounded-card border border-line bg-ink-850 p-4 md:p-5">
      <div className="flex flex-col gap-2">
        <h2 id="raid-loot-heading" className="font-display text-2xl font-medium">{RAID_LOOT.heading}</h2>
        <p className="max-w-[720px] text-sm text-fg-2">{RAID_LOOT.lede}{loot.live && ` ${RAID_LOOT.live}`}</p>
      </div>
      <p role="status" className={failed ? 'text-sm text-warn' : 'sr-only'}>{failed ? RAID_LOOT.refreshFailed : ''}</p>
      {loot.awards.length === 0 ? <p className="text-sm text-fg-muted">{RAID_LOOT.empty}</p> : (
        <div className="rounded-card border border-line bg-ink-900">
          <div aria-hidden="true" className={`hidden py-1.5 text-label font-semibold uppercase tracking-[0.08em] text-fg-3 ${columns}`}>
            {RAID_LOOT.columns.map((label) => <span key={label}>{label}</span>)}
          </div>
          <ol className="divide-y divide-line-faint md:border-t md:border-line-faint">
            {loot.awards.map((award) => (
              <li key={award.id} className={`min-w-0 px-3 pb-2 pt-1 text-sm md:min-h-11 md:py-0 ${columns}`}>
                <ItemName item={award.item} className="text-sm [&_button>span>span]:whitespace-normal [&_button>span>span]:[overflow-wrap:anywhere]" />
                <span className="flex flex-wrap items-baseline gap-y-0.5 text-fg-2 md:contents">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {award.characterName ? <><span className="font-semibold text-fg" style={award.wowClass ? { color: CLASS_COLORS[award.wowClass].onInk } : undefined}>{award.characterName}</span>{!award.characterId && <> <span className="text-xs text-fg-3">{RAID_LOOT.deleted}</span></>}</> : <span className="text-fg-3" aria-label={METHOD_LABEL.DISENCHANT_BANK}>—</span>}
                  </span>
                  <span className={separator}>
                    <span className={award.method === 'HR' ? 'font-semibold text-sand' : award.method === 'SR' ? 'font-semibold text-teal' : award.method === 'DISENCHANT_BANK' ? 'text-fg-2' : 'font-semibold text-fg'}>{METHOD_LABEL[award.method]}</span>
                    {award.roll !== null && <span className="tabular-nums"> · {award.roll}</span>}
                  </span>
                  <span className={`text-[13px] ${separator}`}>{award.bossName ?? '—'}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
