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

/** An optimistic-concurrency fingerprint, not authorization; apply must recompute it in its transaction. */
export function tableStateToken(state: LoadTableState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

/** Only additions are proposed. Existing bosses, entries and reserve settings are never overwritten. */
export function mergePreview(state: LoadTableState, file: ParsedTable, available: ReadonlySet<number>) {
  const byName = new Map(file.bosses.map((boss) => [boss.name, boss]));
  const names = new Set(state.lootBosses.map((boss) => boss.name));
  const ordered = [
    ...state.lootBosses.map((boss) => ({ existing: boss, incoming: byName.get(boss.name) })),
    ...file.bosses.filter((boss) => !names.has(boss.name)).map((incoming) => ({ existing: undefined, incoming })),
  ];
  const bosses = ordered.map(({ existing, incoming }) => {
    const current = new Set(existing?.entries.map((entry) => entry.itemId) ?? []);
    const ids = incoming?.itemIds ?? [];
    return {
      bossId: existing?.id ?? null, name: existing?.name ?? incoming!.name,
      isTrash: existing?.isTrash ?? incoming!.isTrash, isNew: !existing,
      add: ids.filter((id) => !current.has(id) && available.has(id)),
      already: ids.filter((id) => current.has(id)),
      notFound: ids.filter((id) => !available.has(id)),
    };
  });
  return { token: tableStateToken(state), bosses, added: bosses.reduce((n, boss) => n + boss.add.length, 0), newBosses: bosses.filter((boss) => boss.isNew).length };
}

/** Caller authorizes the officer and validates file/source/metadata. Never fetches items. */
export async function applyLootTable(input: {
  templateId: string; file: ParsedTable; source: ItemSource; token: string;
  sourceName: string; officerId: string; officerName: string;
}) {
  return db.$transaction(async (tx) => {
    await lockReserveTier(tx, input.templateId);
    const state = await tx.raidTemplate.findUnique({ where: { id: input.templateId }, select: LOAD_TABLE_SELECT });
    if (!state) return { ok: false as const, status: 404, error: 'No such raid tier.' };
    if (tableStateToken(state) !== input.token) return { ok: false as const, status: 409, error: 'The table changed since this preview.' };
    const cached = await tx.lootItem.findMany({ where: { id: { in: allItemIds(input.file) } }, select: { id: true, source: true } });
    const conflicts = cached.filter((item) => item.source !== input.source).map((item) => item.id);
    if (conflicts.length) return { ok: false as const, status: 409, error: `Item ids ${conflicts.join(', ')}: ${SOURCE_CONFLICT}`, conflicts };
    const preview = mergePreview(state, input.file, new Set(cached.map((item) => item.id)));
    if (!preview.added && !preview.newBosses) return { ok: true as const, added: 0, newBosses: 0 };
    let bossPosition = Math.max(-1, ...state.lootBosses.map((boss) => boss.position)) + 1;
    for (const boss of preview.bosses) {
      const id = boss.bossId ?? (await tx.lootBoss.create({
        data: { templateId: input.templateId, name: boss.name, isTrash: boss.isTrash, position: bossPosition++ }, select: { id: true },
      })).id;
      const existing = state.lootBosses.find((entry) => entry.id === id);
      const position = Math.max(-1, ...(existing?.entries.map((entry) => entry.position) ?? [])) + 1;
      if (boss.add.length) await tx.lootTableEntry.createMany({ data: boss.add.map((itemId, index) => ({ bossId: id, itemId, position: position + index })) });
    }
    await tx.lootTableLoad.create({ data: {
      templateId: input.templateId, sourceName: input.sourceName, officerId: input.officerId,
      officerName: input.officerName, mode: 'merge', added: preview.added, removed: 0,
    } });
    return { ok: true as const, added: preview.added, newBosses: preview.newBosses };
  }, { isolationLevel: 'ReadCommitted' });
}

/** Officer page callers authorize access; no public history endpoint. */
export async function lootLoadHistory(templateId: string) {
  return db.lootTableLoad.findMany({
    where: { templateId }, take: 10, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { sourceName: true, officerName: true, createdAt: true, mode: true, added: true, removed: true },
  });
}
