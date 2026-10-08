import { createHash } from 'node:crypto';
import type { Prisma } from '@/lib/generated/prisma/client';
import type { ParsedTable } from './loot-import';

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
