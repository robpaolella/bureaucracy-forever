/**
 * The LootItem cache. Filled from Wowhead by the import script and the officer refresh
 * action only (lib/wowhead.ts). Takes the Prisma client as an argument so the script,
 * which runs outside Next, can pass its own.
 */
import type { PrismaClient } from '@/lib/generated/prisma/client';
import type { ItemSource } from '@/lib/loot-rules';
import { itemSourceError, SOURCE_CONFLICT } from '@/lib/item-sources';
import { sanitizeTooltip } from '@/lib/tooltip-sanitize';
import { fetchItem, throttled, WOWHEAD_GAP_MS } from '@/lib/wowhead';

/** What pages hand to item components. The tooltip is sanitized again on the way out. */
export type ItemView = { id: number; name: string; quality: number; icon: string; tooltipHtml: string };

export function toItemView(row: { id: number; name: string; quality: number; icon: string; tooltipHtml: string }): ItemView {
  return { id: row.id, name: row.name, quality: row.quality, icon: row.icon, tooltipHtml: sanitizeTooltip(row.tooltipHtml) };
}

/** Why an unlisted drop's item can't be used; the loot log shows a state for each. */
export type LookupError = { ok: false; code: 'not-forever' | 'not-found' | 'wowhead-down'; status: 400 | 404 | 502; error: string };
/** `cached`: already in the LootItem cache, so recording it writes no item row. The tooltip is sanitized. */
export type ForeverLookup = { ok: true; item: ItemView; cached: boolean } | LookupError;

/**
 * A Forever item from the cache, or else from Wowhead's Forever database. Saves nothing.
 * An id cached from Classic is refused, since recording it would mix the two games.
 */
export async function lookupForeverItem(client: Pick<PrismaClient, 'lootItem'>, id: number, fetcher?: typeof fetch): Promise<ForeverLookup> {
  const cached = await client.lootItem.findUnique({ where: { id }, select: { id: true, name: true, quality: true, icon: true, tooltipHtml: true, source: true } });
  if (cached?.source === 'FOREVER') return { ok: true, item: toItemView(cached), cached: true };
  if (cached) return { ok: false, code: 'not-forever', status: 400, error: SOURCE_CONFLICT };
  const res = await fetchItem(id, 'FOREVER', fetcher);
  if (res.ok) return { ok: true, item: toItemView({ ...res.item, tooltipHtml: res.item.tooltip }), cached: false };
  return res.notFound
    ? { ok: false, code: 'not-found', status: 404, error: `Wowhead Forever has no item ${id}. Check the link.` }
    : { ok: false, code: 'wowhead-down', status: 502, error: 'Couldn’t reach Wowhead.' };
}

export type RefreshTarget = { id: number; source: ItemSource };
export type RefreshResult = { saved: number[]; failed: { id: number; error: string }[]; notReached: number[] };

/**
 * Fetches each item from Wowhead in turn and upserts it. One failure never stops the rest.
 * With `deadline` (epoch ms) no new fetch starts after it; those ids come back as `notReached`.
 */
export async function refreshItems(
  client: Pick<PrismaClient, 'lootItem'>,
  targets: readonly RefreshTarget[],
  opts: { fetcher?: typeof fetch; gapMs?: number; now?: () => Date; deadline?: number } = {},
): Promise<RefreshResult> {
  const sourceOf = new Map(targets.map((t) => [t.id, t.source]));
  const conflicting = new Set(targets.filter((t) => sourceOf.get(t.id) !== t.source).map((t) => t.id));
  const out: RefreshResult = { saved: [], failed: [], notReached: [] };
  await throttled(
    [...sourceOf.keys()],
    async (id) => {
      if (opts.deadline !== undefined && Date.now() >= opts.deadline) {
        out.notReached.push(id);
        return 'skip' as const;
      }
      const source = sourceOf.get(id)!;
      const policyError = itemSourceError(source);
      if (policyError || conflicting.has(id)) {
        out.failed.push({ id, error: policyError ?? SOURCE_CONFLICT });
        return 'skip' as const;
      }
      try {
        const cached = await client.lootItem.findUnique({ where: { id }, select: { source: true } });
        if (cached && cached.source !== source) {
          out.failed.push({ id, error: SOURCE_CONFLICT });
          return 'skip' as const;
        }
        const res = await fetchItem(id, source, opts.fetcher);
        if (!res.ok) {
          out.failed.push({ id, error: res.error });
          return;
        }
        const data = { name: res.item.name, quality: res.item.quality, icon: res.item.icon, tooltipHtml: sanitizeTooltip(res.item.tooltip), fetchedAt: (opts.now ?? (() => new Date()))() };
        // The source predicate protects against another writer inserting the other game's
        // item during the fetch. Never include source in update, even after the precheck.
        const saved = await client.lootItem.upsert({ where: { id, source }, create: { id, source, ...data }, update: data });
        // PostgreSQL's conditional ON CONFLICT returns no row when the source differs.
        if (!saved) out.failed.push({ id, error: SOURCE_CONFLICT });
        else out.saved.push(id);
      } catch (error) {
        const collision = error && typeof error === 'object' && 'code' in error && error.code === 'P2002';
        out.failed.push({ id, error: collision ? SOURCE_CONFLICT : 'Could not save it.' });
      }
    },
    opts.gapMs ?? WOWHEAD_GAP_MS,
  );
  return out;
}
