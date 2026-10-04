'use client';

import { useEffect, useState } from 'react';
import { ItemName } from '@/components/loot/ItemName';
import { METHOD_LABEL } from '@/content/loot-log';
import { RAID_LOOT } from '@/content/raid-loot';
import type { RaidLootView } from '@/lib/loot-data';

/** One in-flight read at a time; no reads before the start or at/after the end. */
export function startRaidLootPolling(raidId: string, startsAt: string, endsAt: string, receive: (loot: RaidLootView | null) => void, failure: (failed: boolean) => void) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  function schedule(delay: number) {
    timer = setTimeout(refresh, Math.min(delay, 2_147_483_647));
  }
  async function refresh() {
    if (Date.now() >= end || controller.signal.aborted) return;
    if (Date.now() < start) { schedule(start - Date.now()); return; }
    try {
      const response = await fetch(`/members/calendar/${encodeURIComponent(raidId)}/loot`, { cache: 'no-store', signal: controller.signal });
      if (controller.signal.aborted) return;
      if (response.redirected || [404, 401, 403].includes(response.status)) {
        receive(null);
        return;
      }
      if (!response.ok) throw new Error('refresh failed');
      const next: RaidLootView = await response.json();
      if (!controller.signal.aborted) { receive(next); failure(false); }
    } catch {
      if (!controller.signal.aborted) failure(true);
    }
    if (!controller.signal.aborted && Date.now() < end) schedule(30_000);
  }
  if (Date.now() < end) schedule(Date.now() < start ? start - Date.now() : 30_000);
  return () => { controller.abort(); clearTimeout(timer); };
}

/** Read-only member list. Poll just this data, without refreshing officer forms or the page. */
export function RaidLoot({ raidId, initial }: { raidId: string; initial: RaidLootView }) {
  const [loot, setLoot] = useState<RaidLootView | null>(initial);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState({ revision: 0, count: 0 });
  const [previous, setPrevious] = useState(initial);
  if (previous !== initial) {
    setPrevious(initial);
    setLoot(initial);
    setFailed(false);
  }

  const startsAt = loot?.startsAt;
  const endsAt = loot?.endsAt;
  useEffect(() => {
    if (!startsAt || !endsAt) return;
    let previousAwards = JSON.stringify(initial.awards);
    return startRaidLootPolling(raidId, startsAt, endsAt, (next) => {
      if (next) {
        const awards = JSON.stringify(next.awards);
        if (awards !== previousAwards) {
          setAnnouncement((current) => ({ revision: current.revision + 1, count: next.awards.length }));
          previousAwards = awards;
        }
      }
      setLoot(next);
    }, setFailed);
  }, [raidId, startsAt, endsAt, initial.awards]);

  if (!loot) return null;
  return (
    <section id="raid-loot" aria-labelledby="raid-loot-heading" className="flex flex-col gap-4 rounded-card border border-line bg-ink-850 p-4 md:p-5">
      <div className="flex flex-col gap-2">
        <h2 id="raid-loot-heading" className="font-display text-2xl font-medium">{RAID_LOOT.heading}</h2>
        <p className="text-sm text-fg-2">{RAID_LOOT.lede}</p>
      </div>
      <p role="status" className="sr-only"><span key={announcement.revision}>{announcement.revision > 0 ? RAID_LOOT.updated(announcement.count) : ''}</span></p>
      {failed && <p role="status" className="text-sm text-warn">{RAID_LOOT.refreshFailed}</p>}
      {loot.awards.length === 0 ? <p className="text-sm text-fg-2">{RAID_LOOT.empty}</p> : (
        <ol className="divide-y divide-line">
          {loot.awards.map((award) => (
            <li key={award.id} className="grid min-w-0 gap-2 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-6">
              <ItemName item={award.item} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
                <div className="min-w-0">
                  <dt className="text-small text-fg-2">{RAID_LOOT.winner}</dt>
                  <dd className="break-words">{award.method === 'DISENCHANT_BANK' ? METHOD_LABEL.DISENCHANT_BANK : award.characterName ?? RAID_LOOT.unknownWinner}</dd>
                </div>
                <div><dt className="text-small text-fg-2">{RAID_LOOT.method}</dt><dd>{METHOD_LABEL[award.method]}</dd></div>
                <div><dt className="text-small text-fg-2">{RAID_LOOT.roll}</dt><dd className="tabular-nums">{award.roll ?? '—'}</dd></div>
                <div className="min-w-0"><dt className="text-small text-fg-2">{RAID_LOOT.boss}</dt><dd className="break-words">{award.bossName ?? '—'}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
