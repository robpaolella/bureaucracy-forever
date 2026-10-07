'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, EmptyState } from '@/components/ui';
import { MemberAwardList } from '@/components/loot/RaidLoot';
import { LOOT_HISTORY } from '@/content/loot';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { LootHistoryView } from '@/lib/member-loot';

const guildDate = new Intl.DateTimeFormat('en-US', { timeZone: GUILD_TIMEZONE, weekday: 'short', month: 'short', day: 'numeric' });

export function LootHistory({ initial }: { initial: LootHistoryView }) {
  const router = useRouter();
  const [history, setHistory] = useState<LootHistoryView | null>(initial);
  const [previous, setPrevious] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  if (previous !== initial) { setPrevious(initial); setHistory(initial); }
  if (error) throw error; // The site's existing error boundary supplies Retry.
  async function older() {
    if (!history?.next || loading) return;
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`/members/loot/older?${new URLSearchParams(history.next)}`, { cache: 'no-store', signal: controller.signal });
      if (response.redirected || [401, 403, 404].includes(response.status)) { setHistory(null); router.refresh(); return; }
      if (!response.ok) throw new Error('Loot history request failed');
      const next: LootHistoryView = await response.json();
      setHistory({ raids: [...history.raids, ...next.raids.filter((r) => !history.raids.some((old) => old.id === r.id))], next: next.next });
    } catch (e) { setError(e instanceof Error ? e : new Error('Loot history request failed')); }
    finally { clearTimeout(timeout); setLoading(false); }
  }
  if (!history) return null;
  if (!history.raids.length) return <EmptyState title={LOOT_HISTORY.emptyTitle}>{LOOT_HISTORY.empty}</EmptyState>;
  return <>
    <div className="flex flex-col gap-7">
      {history.raids.map((raid) => <section key={raid.id} aria-labelledby={`history-${raid.id}`} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1">
          <h2 id={`history-${raid.id}`} className="font-display text-[22px] font-medium leading-[1.2]">
            <Link href={`/members/calendar/${raid.id}`} className="inline-flex min-h-11 items-center underline decoration-line-strong underline-offset-4 hover:decoration-current">{raid.name}</Link>
          </h2>
          <time dateTime={raid.startsAt} className="text-sm text-fg-2">{guildDate.format(new Date(raid.startsAt))}</time>
          <span className="text-[13px] tabular-nums text-fg-muted">{raid.awards.length} {raid.awards.length === 1 ? 'award' : 'awards'}</span>
        </div>
        <MemberAwardList awards={raid.awards} />
      </section>)}
    </div>
    {history.next && <div className="flex justify-center"><Button variant="secondary" size="sm" loading={loading} onClick={() => void older()}>{LOOT_HISTORY.older}</Button></div>}
  </>;
}
