import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusPill } from '@/components/ui';
import { LOOT_ADMIN_HEAD, LOOT_TABLES } from '@/content/loot-admin';
import { db } from '@/lib/db';
import { lootEnabled } from '@/lib/flags';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Loot tables', robots: { index: false, follow: false } };

/** /officers/loot: every raid tier with the size of its loot table. Behind LOOT_ENABLED. */
export default async function LootTablesPage() {
  // Session first: it reads cookies, so the page renders per request and the flag is read at
  // run time rather than baked in at build.
  const session = await getSession();
  if (!lootEnabled() || !session || session.role !== 'officer') notFound();

  const [templates, entries] = await Promise.all([
    db.raidTemplate.findMany({ select: { id: true, name: true, short: true, active: true, _count: { select: { lootBosses: true } } }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    db.lootTableEntry.findMany({ select: { itemId: true, boss: { select: { templateId: true } } } }),
  ]);
  const items = new Map<string, Set<number>>();
  for (const e of entries) {
    const set = items.get(e.boss.templateId) ?? new Set<number>();
    set.add(e.itemId);
    items.set(e.boss.templateId, set);
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{LOOT_ADMIN_HEAD.eyebrow}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{LOOT_ADMIN_HEAD.title}</h1>
        <p className="max-w-[640px] text-[15px] leading-[1.65] text-fg-2">{LOOT_ADMIN_HEAD.lede}</p>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="tiers">
        <h2 id="tiers" className="font-display text-2xl font-medium">
          {LOOT_TABLES.heading}
        </h2>
        {templates.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-sm text-fg-2">{LOOT_TABLES.empty}</p>
        ) : (
          <ul className="divide-y divide-line-faint rounded-card border border-line bg-ink-900">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/officers/loot/${t.id}`} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors duration-[120ms] hover:bg-ink-800">
                  <span className="flex min-w-[14rem] flex-1 flex-col">
                    <span className="text-[15px] font-semibold">
                      {t.name} <span className="text-fg-3">· {t.short}</span>
                    </span>
                    <span className="tabular text-[13px] text-fg-3">{LOOT_TABLES.counts(t._count.lootBosses, items.get(t.id)?.size ?? 0)}</span>
                  </span>
                  {!t.active && <StatusPill tone="closed">{LOOT_TABLES.inactive}</StatusPill>}
                  <span className="text-sm font-semibold text-teal" aria-hidden>
                    {LOOT_TABLES.open} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
