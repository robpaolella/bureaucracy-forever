import { createHash } from 'node:crypto';
import type { Prisma } from '@/lib/generated/prisma/client';
import { allItemIds, type ParsedTable } from './loot-import';
import { db } from './db';
import { lockReserveTier } from './loot-blocks';
import { SOURCE_CONFLICT } from './item-sources';
import type { ItemSource } from './generated/prisma/client';

/** Shared with apply: read and hash the entire merge-sensitive state, including reserve policy. */
export const LOAD_TABLE_SELECT = {
  id: true,
  lootBosses: { orderBy: [{ position: 'asc' }, { id: 'asc' }], select: {
    id: true, name: true, position: true, isTrash: true,
    entries: { orderBy: [{ position: 'asc' }, { itemId: 'asc' }], select: { itemId: true, position: true } },
  } },
  reserveSettings: { orderBy: { itemId: 'asc' }, select: { itemId: true, blocked: true, winLimit: true } },
} satisfies Prisma.RaidTemplateSelect;
export type LoadTableState = Prisma.RaidTemplateGetPayload<{ select: typeof LOAD_TABLE_SELECT }>;

/** Table items that replace must keep, sorted: reserved in any raid of the tier, or awarded in it, voided or not (Robert, #126). */
export type Protection = { reserves: number[]; awards: number[] };

/**
 * Pass the locked transaction when enforcing. Reserve saves take the tier lock; recording an
 * award doesn't, so apply also locks the award table while it reads and removes.
 */
export async function protectedItems(client: Pick<Prisma.TransactionClient, 'reserve' | 'lootAward'>, state: LoadTableState): Promise<Protection> {
  const where = { itemId: { in: [...new Set(state.lootBosses.flatMap((boss) => boss.entries.map((entry) => entry.itemId)))] }, raid: { templateId: state.id } };
  const select = { itemId: true }, orderBy = { itemId: 'asc' } as const;
  const reserves = await client.reserve.findMany({ where, select, orderBy, distinct: ['itemId'] });
  const awards = await client.lootAward.findMany({ where, select, orderBy, distinct: ['itemId'] });
  return { reserves: reserves.map((row) => row.itemId), awards: awards.map((row) => row.itemId) };
}

/**
 * An optimistic-concurrency fingerprint, not authorization; apply must recompute it in its transaction.
 * Replace also covers protection, so a reserve or award made after the preview makes it stale.
 */
export function tableStateToken(state: LoadTableState, protection?: Protection): string {
  return createHash('sha256').update(JSON.stringify(protection ? { state, protection } : state)).digest('hex');
}

/**
 * Merge (no protection) only adds: existing bosses, entries and reserve settings are never overwritten.
 * Replace also removes entries the source doesn't have, except protected items, and bosses absent
 * from the source with nothing protected (Robert, #47). Reserve settings stay either way.
 */
export function mergePreview(state: LoadTableState, file: ParsedTable, available: ReadonlySet<number>, protection?: Protection) {
  const awarded = new Set(protection?.awards), reserved = new Set(protection?.reserves);
  const byName = new Map(file.bosses.map((boss) => [boss.name, boss]));
  const names = new Set(state.lootBosses.map((boss) => boss.name));
  const ordered = [
    ...state.lootBosses.map((boss) => ({ existing: boss, incoming: byName.get(boss.name) })),
    ...file.bosses.filter((boss) => !names.has(boss.name)).map((incoming) => ({ existing: undefined, incoming })),
  ];
  const bosses = ordered.map(({ existing, incoming }) => {
    const current = new Set(existing?.entries.map((entry) => entry.itemId) ?? []);
    const ids = incoming?.itemIds ?? [];
    const gone = protection ? (existing?.entries ?? []).map((entry) => entry.itemId).filter((id) => !ids.includes(id)) : [];
    // An item with both says awards: the stronger reason.
    const kept = gone.flatMap((id): { id: number; has: 'awards' | 'reserves' }[] => (awarded.has(id) ? [{ id, has: 'awards' }] : reserved.has(id) ? [{ id, has: 'reserves' }] : []));
    return {
      bossId: existing?.id ?? null, name: existing?.name ?? incoming!.name,
      isTrash: existing?.isTrash ?? incoming!.isTrash, isNew: !existing,
      add: ids.filter((id) => !current.has(id) && available.has(id)),
      already: ids.filter((id) => current.has(id)),
      notFound: ids.filter((id) => !available.has(id)),
      remove: gone.filter((id) => !awarded.has(id) && !reserved.has(id)),
      kept,
      /** A table boss the source doesn't have, in replace: removed unless it keeps a protected item. */
      absent: protection && !incoming ? (kept.length ? 'keep' as const : 'remove' as const) : null,
    };
  });
  const sum = (count: (boss: (typeof bosses)[number]) => number) => bosses.reduce((n, boss) => n + count(boss), 0);
  return {
    token: tableStateToken(state, protection), bosses, added: sum((boss) => boss.add.length), newBosses: bosses.filter((boss) => boss.isNew).length,
    removed: sum((boss) => boss.remove.length), removedBosses: bosses.filter((boss) => boss.absent === 'remove').length, kept: sum((boss) => boss.kept.length),
  };
}

/** Caller authorizes the officer and validates file/source/metadata. Never fetches items. */
export async function applyLootTable(input: {
  templateId: string; file: ParsedTable; source: ItemSource; token: string;
  sourceName: string; officerId: string; officerName: string; replace?: boolean;
}) {
  return db.$transaction(async (tx) => {
    await lockReserveTier(tx, input.templateId);
    // Award inserts wait for this load to commit, and this waits for any in flight, so protection read below is final.
    if (input.replace) await tx.$executeRaw`LOCK TABLE "LootAward" IN SHARE MODE`;
    const state = await tx.raidTemplate.findUnique({ where: { id: input.templateId }, select: LOAD_TABLE_SELECT });
    if (!state) return { ok: false as const, status: 404, error: 'No such raid tier.' };
    const protection = input.replace ? await protectedItems(tx, state) : undefined;
    if (tableStateToken(state, protection) !== input.token) return { ok: false as const, status: 409, error: 'The table changed since this preview.' };
    const cached = await tx.lootItem.findMany({ where: { id: { in: allItemIds(input.file) } }, select: { id: true, source: true } });
    const conflicts = cached.filter((item) => item.source !== input.source).map((item) => item.id);
    if (conflicts.length) return { ok: false as const, status: 409, error: `Item ids ${conflicts.join(', ')}: ${SOURCE_CONFLICT}`, conflicts };
    const preview = mergePreview(state, input.file, new Set(cached.map((item) => item.id)), protection);
    if (!preview.added && !preview.newBosses && !preview.removed && !preview.removedBosses) return { ok: true as const, added: 0, newBosses: 0, removed: 0 };
    // Removal is recomputed here from the locked state, never taken from the request.
    for (const boss of preview.bosses) {
      // Awards keep the boss name; their link to a removed boss is cleared by the schema.
      if (boss.absent === 'remove') await tx.lootBoss.delete({ where: { id: boss.bossId! } });
      else if (boss.remove.length) await tx.lootTableEntry.deleteMany({ where: { bossId: boss.bossId!, itemId: { in: boss.remove } } });
    }
    let bossPosition = Math.max(-1, ...state.lootBosses.map((boss) => boss.position)) + 1;
    for (const boss of preview.bosses.filter((entry) => entry.absent !== 'remove')) {
      const id = boss.bossId ?? (await tx.lootBoss.create({
        data: { templateId: input.templateId, name: boss.name, isTrash: boss.isTrash, position: bossPosition++ }, select: { id: true },
      })).id;
      const existing = state.lootBosses.find((entry) => entry.id === id);
      const position = Math.max(-1, ...(existing?.entries.map((entry) => entry.position) ?? [])) + 1;
      if (boss.add.length) await tx.lootTableEntry.createMany({ data: boss.add.map((itemId, index) => ({ bossId: id, itemId, position: position + index })) });
    }
    await tx.lootTableLoad.create({ data: {
      templateId: input.templateId, sourceName: input.sourceName, officerId: input.officerId,
      officerName: input.officerName, mode: input.replace ? 'replace' : 'merge', added: preview.added, removed: preview.removed,
    } });
    return { ok: true as const, added: preview.added, newBosses: preview.newBosses, removed: preview.removed };
  }, { isolationLevel: 'ReadCommitted' });
}

/** Officer page callers authorize access; no public history endpoint. */
export async function lootLoadHistory(templateId: string) {
  return db.lootTableLoad.findMany({
    where: { templateId }, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { sourceName: true, officerName: true, createdAt: true, mode: true, added: true, removed: true },
  });
}
