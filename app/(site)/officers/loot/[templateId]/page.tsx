import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemName } from '@/components/loot/ItemName';
import { Tag } from '@/components/ui';
import { LOOT_ADMIN_HEAD, LOOT_TABLE } from '@/content/loot-admin';
import { db } from '@/lib/db';
import { lootEnabled } from '@/lib/flags';
import { toItemView } from '@/lib/loot-items';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Loot table', robots: { index: false, follow: false } };

/** /officers/loot/[templateId]: one raid tier's loot table, boss by boss. Behind LOOT_ENABLED. */
export default async function LootTablePage({ params }: { params: Promise<{ templateId: string }> }) {
  // Session first: it reads cookies, so the page renders per request and the flag is read at
  // run time rather than baked in at build.
  const session = await getSession();
  if (!lootEnabled() || !session || session.role !== 'officer') notFound();

  const { templateId } = await params;
  const template = await db.raidTemplate.findUnique({
    where: { id: templateId },
    select: {
      name: true,
      lootBosses: {
        orderBy: { position: 'asc' },
        select: { id: true, name: true, isTrash: true, entries: { orderBy: { position: 'asc' }, select: { item: true } } },
      },
    },
  });
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <Link href="/officers/loot" className="inline-flex min-h-11 items-center self-start text-small text-fg-3 underline-offset-4 hover:underline">
          ← {LOOT_TABLE.back}
        </Link>
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{LOOT_ADMIN_HEAD.title}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{template.name}</h1>
      </section>
      {template.lootBosses.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-6 py-8 text-center text-sm text-fg-2">{LOOT_TABLE.empty}</p>
      ) : (
        template.lootBosses.map((boss) => (
          <section key={boss.id} className="flex flex-col gap-2" aria-labelledby={`boss-${boss.id}`}>
            <div className="flex items-center gap-3">
              <h2 id={`boss-${boss.id}`} className="font-display text-2xl font-medium">
                {boss.name}
              </h2>
              {boss.isTrash && <Tag>{LOOT_TABLE.trash}</Tag>}
              <span className="tabular text-[13px] text-fg-3">{boss.entries.length}</span>
            </div>
            {boss.entries.length === 0 ? (
              <p className="text-sm text-fg-3">{LOOT_TABLE.noItems}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-x-6 rounded-card border border-line bg-ink-900 px-4 py-2 md:grid-cols-2 xl:grid-cols-3">
                {boss.entries.map(({ item }) => (
                  <li key={item.id} className="flex min-w-0 items-center justify-between gap-3">
                    <ItemName item={toItemView(item)} className="min-w-0" />
                    <span className="tabular shrink-0 text-xs text-fg-3">{LOOT_TABLE.itemId(item.id)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
    </div>
  );
}
