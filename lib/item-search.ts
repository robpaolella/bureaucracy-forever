import { RESERVES } from '@/content/reserves';
import type { LootTableView } from '@/lib/loot-data';
import type { ItemView } from '@/lib/loot-items';

export type SearchItem = { item: ItemView; bosses: string[]; bossLabel: string };

/** One row per item, regardless of how many bosses drop it. Never mutates the table. */
export function searchableItems(table: LootTableView): SearchItem[] {
  const rows = new Map<number, SearchItem>();
  for (const boss of table.bosses) {
    for (const id of new Set(boss.itemIds)) {
      const item = table.items[id];
      if (!item) continue;
      const name = boss.isTrash ? RESERVES.trash : boss.name;
      const row = rows.get(id) ?? { item, bosses: [], bossLabel: '' };
      row.bosses.push(name);
      row.bossLabel = row.bosses.length > 1 ? RESERVES.shared : name;
      rows.set(id, row);
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.item.name.localeCompare(b.item.name) || a.item.id - b.item.id)
    .map((row) => ({ ...row, item: { ...row.item, tooltipHtml: `${row.item.tooltipHtml}<p>${row.bosses.join(', ').replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)}</p>` } }));
}

export function filterItems(rows: readonly SearchItem[], query: string): SearchItem[] {
  const term = query.trim().toLocaleLowerCase();
  return rows.filter(({ item }) => item.name.toLocaleLowerCase().includes(term));
}
