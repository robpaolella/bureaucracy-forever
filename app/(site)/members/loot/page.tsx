import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LootHistory } from '@/components/loot/LootHistory';
import { LOOT_HISTORY } from '@/content/loot';
import { loadMemberLootHistory, type LootHistoryFilters } from '@/lib/member-loot';

export const metadata: Metadata = { title: LOOT_HISTORY.title, robots: { index: false, follow: false } };

type SearchParams = { characterId?: string | string[]; characterName?: string | string[]; templateId?: string | string[] };
const one = (value: string | string[] | undefined) => typeof value === 'string' ? value : undefined;

export default async function LootHistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const filters: LootHistoryFilters = { ...(one(query.characterId) && { characterId: one(query.characterId) }), ...(one(query.characterName) && { characterName: one(query.characterName) }), ...(one(query.templateId) && { templateId: one(query.templateId) }) };
  const history = await loadMemberLootHistory(null, filters);
  if (!history) notFound();
  return <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
    <section className="flex flex-col gap-3">
      <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{LOOT_HISTORY.eyebrow}</span>
      <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{LOOT_HISTORY.title}</h1>
      <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{LOOT_HISTORY.lede}</p>
    </section>
    <LootHistory initial={history} />
  </div>;
}
