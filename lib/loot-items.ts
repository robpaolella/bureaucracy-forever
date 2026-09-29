/**
 * The LootItem cache. Filled from Wowhead by the import script and the officer refresh
 * action only (lib/wowhead.ts). Takes the Prisma client as an argument so the script,
 * which runs outside Next, can pass its own.
 */
import type { PrismaClient } from '@/lib/generated/prisma/client';
import type { ItemSource } from '@/lib/loot-rules';
import { sanitizeTooltip } from '@/lib/tooltip-sanitize';
import { fetchItem, throttled, WOWHEAD_GAP_MS } from '@/lib/wowhead';

/** What pages hand to item components. The tooltip is sanitized again on the way out. */
export type ItemView = { id: number; name: string; quality: number; icon: string; tooltipHtml: string };

export function toItemView(row: { id: number; name: string; quality: number; icon: string; tooltipHtml: string }): ItemView {
  return { id: row.id, name: row.name, quality: row.quality, icon: row.icon, tooltipHtml: sanitizeTooltip(row.tooltipHtml) };
}

export type RefreshTarget = { id: number; source: ItemSource };
export type RefreshResult = { saved: number[]; failed: { id: number; error: string }[] };

/** Fetches each item from Wowhead in turn and upserts it. One failure never stops the rest. */
export async function refreshItems(
  client: Pick<PrismaClient, 'lootItem'>,
  targets: readonly RefreshTarget[],
  opts: { fetcher?: typeof fetch; gapMs?: number; now?: () => Date } = {},
): Promise<RefreshResult> {
  const sourceOf = new Map(targets.map((t) => [t.id, t.source]));
  const out: RefreshResult = { saved: [], failed: [] };
  await throttled(
    [...sourceOf.keys()],
    async (id) => {
      const source = sourceOf.get(id)!;
      const res = await fetchItem(id, source, opts.fetcher);
      if (!res.ok) {
        out.failed.push({ id, error: res.error });
        return;
      }
      const data = { name: res.item.name, quality: res.item.quality, icon: res.item.icon, tooltipHtml: sanitizeTooltip(res.item.tooltip), source, fetchedAt: (opts.now ?? (() => new Date()))() };
      try {
        await client.lootItem.upsert({ where: { id }, create: { id, ...data }, update: data });
        out.saved.push(id);
      } catch {
        out.failed.push({ id, error: 'Could not save it.' });
      }
    },
    opts.gapMs ?? WOWHEAD_GAP_MS,
  );
  return out;
}
