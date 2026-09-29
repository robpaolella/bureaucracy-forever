import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LootTableEditor, type EditorBoss } from '@/components/loot/LootTableEditor';
import { LOOT_ADMIN_HEAD, LOOT_TABLE } from '@/content/loot-admin';
import type { ItemSource } from '@/lib/loot-rules';
import { db } from '@/lib/db';
import { lootEnabled } from '@/lib/flags';
import { toItemView } from '@/lib/loot-items';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Loot table', robots: { index: false, follow: false } };

/** /officers/loot/[templateId]: one raid tier's loot table, boss by boss, for officers to edit. Behind LOOT_ENABLED. */
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

  const bosses: EditorBoss[] = template.lootBosses.map((b) => ({ id: b.id, name: b.name, isTrash: b.isTrash, items: b.entries.map((e) => toItemView(e.item)) }));
  // New items default to the database most of this tier already uses; Forever when empty.
  const sources = template.lootBosses.flatMap((b) => b.entries.map((e) => e.item.source));
  const defaultSource: ItemSource = sources.filter((x) => x === 'CLASSIC').length > sources.length / 2 ? 'CLASSIC' : 'FOREVER';

  return (
    <div className="flex flex-col gap-6 px-4 pb-12 pt-8 md:px-12 md:pt-11">
      <section className="flex flex-col gap-3">
        <Link href="/officers/loot" className="inline-flex min-h-11 items-center self-start text-small text-fg-3 underline-offset-4 hover:underline">
          ← {LOOT_TABLE.back}
        </Link>
        <span className="font-eyebrow text-label font-semibold uppercase tracking-[0.28em] text-sand">{LOOT_ADMIN_HEAD.title}</span>
        <h1 className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">{template.name}</h1>
      </section>
      <LootTableEditor templateId={templateId} bosses={bosses} defaultSource={defaultSource} />
    </div>
  );
}
