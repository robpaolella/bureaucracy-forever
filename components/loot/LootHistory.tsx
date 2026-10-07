'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, EmptyState, FilterBar } from '@/components/ui';
import { ItemName } from '@/components/loot/ItemName';
import { MemberAwardList } from '@/components/loot/RaidLoot';
import { LOOT_HISTORY } from '@/content/loot';
import { METHOD_LABEL } from '@/content/loot-log';
import { GUILD_TIMEZONE } from '@/lib/config';
import type { LootHistoryFilters, LootHistoryView, MemberAwardView } from '@/lib/member-loot';

const guildDate = new Intl.DateTimeFormat('en-US', { timeZone: GUILD_TIMEZONE, weekday: 'short', month: 'short', day: 'numeric' });
const columns = 'md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_repeat(2,minmax(0,1fr))] md:items-center md:gap-x-4 md:px-4';
const separator = "before:mx-2 before:text-fg-3 before:content-['·'] md:before:hidden";

function query(filters: LootHistoryFilters, cursor?: { startsAt: string; id: string }) {
  return new URLSearchParams({
    ...(filters.characterId && { characterId: filters.characterId }),
    ...(filters.characterName && { characterName: filters.characterName }),
    ...(filters.templateId && { templateId: filters.templateId }),
    ...cursor,
  }).toString();
}

function CharacterAwardList({ raids }: { raids: LootHistoryView['raids'] }) {
  const awards = raids.flatMap((raid) => raid.awards.map((award) => ({ award, raid })));
  return <div className="rounded-card border border-line bg-ink-900">
    <div aria-hidden="true" className={`hidden py-1.5 text-label font-semibold uppercase tracking-[0.08em] text-fg-3 ${columns}`}>
      {LOOT_HISTORY.characterColumns.map((label) => <span key={label}>{label}</span>)}
    </div>
    <ol className="divide-y divide-line-faint md:border-t md:border-line-faint">
      {awards.map(({ award, raid }) => <CharacterAward key={award.id} award={award} raid={raid} />)}
    </ol>
  </div>;
}

function CharacterAward({ award, raid }: { award: MemberAwardView; raid: LootHistoryView['raids'][number] }) {
  return <li className={`min-w-0 px-3 pb-2 pt-1 text-sm md:min-h-11 md:py-0 ${columns}`}>
    <ItemName item={award.item} className="text-sm [&_button>span>span]:whitespace-normal [&_button>span>span]:[overflow-wrap:anywhere]" />
    <span className="flex flex-wrap items-baseline gap-y-0.5 text-fg-2 md:contents">
      <span className="min-w-0 basis-full [overflow-wrap:anywhere]"><Link href={`/members/calendar/${raid.id}`} className="inline-flex min-h-11 min-w-11 items-center font-semibold text-fg underline decoration-line-strong underline-offset-4 hover:decoration-current">{raid.name}</Link> <time dateTime={raid.startsAt} className="text-[13px]">{guildDate.format(new Date(raid.startsAt))}</time></span>
      <span><span className={award.method === 'HR' ? 'font-semibold text-sand' : award.method === 'SR' ? 'font-semibold text-teal' : award.method === 'DISENCHANT_BANK' ? 'text-fg-2' : 'font-semibold text-fg'}>{METHOD_LABEL[award.method]}</span>{award.roll !== null && <span className="tabular-nums"> · {award.roll}</span>}</span>
      <span className={`text-[13px] ${separator}`}>{award.bossName ?? '—'}</span>
    </span>
  </li>;
}

export function appendLootHistory(current: LootHistoryView | null, expected: LootHistoryView, next: LootHistoryView) {
  // A navigation or refresh may have replaced the page while this request was pending.
  return current !== expected ? current : { ...next, raids: [...current.raids, ...next.raids.filter((raid) => !current.raids.some((old) => old.id === raid.id))] };
}

export function LootHistory({ initial }: { initial: LootHistoryView }) {
  const router = useRouter();
  const [history, setHistory] = useState<LootHistoryView | null>(initial);
  const [previous, setPrevious] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pending, startTransition] = useTransition();
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; setLoading(false); }, [initial]);
  if (previous !== initial) { setPrevious(initial); setHistory(initial); }
  if (error) throw error; // The site's existing error boundary supplies Retry.
  if (!history) return null;
  const activeCount = Number(Boolean(history.filters.characterId || history.filters.characterName)) + Number(Boolean(history.filters.templateId));
  const characterSelected = Boolean(history.filters.characterId || history.filters.characterName);
  const selectedCharacter = history.filters.characterId ?? (history.filters.characterName ? `former:${history.filters.characterName}` : '');
  const update = (next: LootHistoryFilters) => {
    if (pending) return;
    request.current?.abort(); request.current = null; setLoading(false);
    startTransition(() => router.push(`/members/loot${query(next) ? `?${query(next)}` : ''}`));
  };
  async function older() {
    const current = history;
    if (!current?.next || loading || pending) return;
    setLoading(true);
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(`/members/loot/older?${query(current.filters, current.next)}`, { cache: 'no-store', signal: controller.signal });
      if (request.current !== controller) return;
      if (response.redirected || [401, 403, 404].includes(response.status)) { setHistory(null); router.refresh(); return; }
      if (!response.ok) throw new Error('Loot history request failed');
      const next: LootHistoryView = await response.json();
      if (request.current === controller) setHistory((latest) => appendLootHistory(latest, current, next));
    } catch (e) { if (request.current === controller) setError(e instanceof Error ? e : new Error('Loot history request failed')); }
    finally { clearTimeout(timeout); if (request.current === controller) { request.current = null; setLoading(false); } }
  }
  if (history.total === 0) return <EmptyState title={LOOT_HISTORY.emptyTitle}>{LOOT_HISTORY.empty}</EmptyState>;
  return <div className="flex flex-col gap-6" aria-busy={pending}>
    <FilterBar summary={activeCount ? LOOT_HISTORY.filteredTotal(history.filteredTotal, history.total) : LOOT_HISTORY.total(history.total)} activeCount={activeCount} onClear={() => update({})}>
      <select aria-label="Character" disabled={pending} value={selectedCharacter} onChange={(event) => {
        const value = event.target.value;
        update({ ...(history.filters.templateId && { templateId: history.filters.templateId }), ...(value && (value.startsWith('former:') ? { characterName: value.slice(7) } : { characterId: value })) });
      }} className="h-11 rounded-control border border-line-strong bg-ink-700 px-3 text-[15px] text-fg md:w-[220px]">
        <option value="">Everyone</option>
        {history.options.characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        {history.options.formerCharacters.length > 0 && <optgroup label="No longer on the roster">{history.options.formerCharacters.map((name) => <option key={name} value={`former:${name}`}>{name}</option>)}</optgroup>}
      </select>
      <select aria-label="Raid" disabled={pending} value={history.filters.templateId ?? ''} onChange={(event) => update({ ...(history.filters.characterId && { characterId: history.filters.characterId }), ...(history.filters.characterName && { characterName: history.filters.characterName }), ...(event.target.value && { templateId: event.target.value }) })} className="h-11 rounded-control border border-line-strong bg-ink-700 px-3 text-[15px] text-fg md:w-[180px]">
        <option value="">All raids</option>
        {history.options.raids.map((raid) => <option key={raid.id} value={raid.id}>{raid.name}</option>)}
      </select>
    </FilterBar>
    {history.filteredTotal === 0 ? <div role="status" className="flex min-h-[156px] flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-2">
      {LOOT_HISTORY.noResults}<Button variant="secondary" size="sm" onClick={() => update({})}>{LOOT_HISTORY.clear}</Button>
    </div> : <>
      {characterSelected ? <CharacterAwardList raids={history.raids} /> : <div className="flex flex-col gap-7">
        {history.raids.map((raid) => <section key={raid.id} aria-labelledby={`history-${raid.id}`} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-1"><h2 id={`history-${raid.id}`} className="font-display text-[22px] font-medium leading-[1.2]"><Link href={`/members/calendar/${raid.id}`} className="inline-flex min-h-11 items-center underline decoration-line-strong underline-offset-4 hover:decoration-current">{raid.name}</Link></h2><time dateTime={raid.startsAt} className="text-sm text-fg-2">{guildDate.format(new Date(raid.startsAt))}</time><span className="text-[13px] tabular-nums text-fg-muted">{raid.awards.length} {raid.awards.length === 1 ? 'award' : 'awards'}</span></div>
          <MemberAwardList awards={raid.awards} linkCharacters />
        </section>)}
      </div>}
      {history.next && <div className="flex justify-center"><Button variant="secondary" size="sm" loading={loading} disabled={pending} onClick={() => void older()}>{LOOT_HISTORY.older}</Button></div>}
    </>}
  </div>;
}
