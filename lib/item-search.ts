import { RESERVES } from '@/content/reserves';
import type { LootTableView } from '@/lib/loot-data';

/** A stable alphabetical list; filtering never changes or mutates the source table. */
export function filterItems<T extends { name: string }>(items: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  return items.filter((item) => item.name.toLocaleLowerCase().includes(needle)).sort((a, b) => a.name.localeCompare(b.name));
}

/** Shared items occur once in the picker, but retain every source for their details. */
export function itemSources(bosses: LootTableView['bosses']): Map<number, string[]> {
  const sources = new Map<number, string[]>();
  for (const boss of bosses) {
    for (const id of new Set(boss.itemIds)) {
      const names = sources.get(id) ?? [];
      const name = boss.isTrash ? RESERVES.trash : boss.name;
      if (!names.includes(name)) names.push(name);
      sources.set(id, names);
    }
  }
  return sources;
}

export function sourceLabel(sources: readonly string[]): string {
  return sources.length > 1 ? RESERVES.shared : sources[0] ?? '';
}

export function sourceDetails(sources: readonly string[]): string {
  if (sources.length === 1 && sources[0] === RESERVES.trash) return RESERVES.trash;
  const names = sources.length < 2 ? sources.join('') : `${sources.slice(0, -1).join(', ')} and ${sources.at(-1)}`;
  return names ? RESERVES.dropsFrom(names) : '';
}
