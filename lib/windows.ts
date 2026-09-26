/**
 * Raid window finder (docs/05 § Find raid windows), ported from the artboard's logic block.
 * For every (day, start) with start + length ≤ 48, take the minimum of each role count
 * across the window; it qualifies if every minimum meets its threshold. Score by the
 * minimum total, so a window that dips in the middle ranks below one that holds.
 */
import { SLOTS } from '@/lib/availability';
import { HEAT_ROLES, type RoleCounts } from '@/lib/heatmap';

export type WindowCell = { total: number; roles: RoleCounts };

export type RaidWindow = {
  day: number;
  start: number;
  /** In half-hour slots. */
  length: number;
  /** The guaranteed total: the lowest count in any slot of the window. */
  score: number;
  /** The guaranteed count per role. */
  roles: RoleCounts;
};

/** Raid lengths offered, in slots: 2h, 3h, 4h. */
export const WINDOW_LENGTHS = [4, 6, 8] as const;
export const DEFAULT_MINIMA: RoleCounts = { tank: 2, healer: 8, melee: 9, ranged: 11 };

/** Every qualifying window, sorted by score descending, then day, then start. */
export function findWindows(cells: WindowCell[][], length: number, minima: RoleCounts): RaidWindow[] {
  const found: RaidWindow[] = [];
  for (let day = 0; day < cells.length; day++) {
    for (let start = 0; start + length <= SLOTS; start++) {
      let score = Infinity;
      const roles: RoleCounts = { tank: Infinity, healer: Infinity, melee: Infinity, ranged: Infinity };
      for (let k = 0; k < length; k++) {
        const cell = cells[day][start + k];
        if (cell.total < score) score = cell.total;
        for (const r of HEAT_ROLES) if (cell.roles[r] < roles[r]) roles[r] = cell.roles[r];
      }
      if (HEAT_ROLES.every((r) => roles[r] >= minima[r])) found.push({ day, start, length, score, roles });
    }
  }
  return found.sort((a, b) => b.score - a.score || a.day - b.day || a.start - b.start);
}

/** At most one window per day, best first, capped. The list stays five different nights, not five Tuesdays. */
export function topWindows(windows: RaidWindow[], limit = 5): RaidWindow[] {
  const seen = new Set<number>();
  const top: RaidWindow[] = [];
  for (const w of windows) {
    if (top.length >= limit) break;
    if (seen.has(w.day)) continue;
    seen.add(w.day);
    top.push(w);
  }
  return top;
}

/** "2T · 8H · 9M · 11R" */
export function formatRoleMinima(roles: RoleCounts): string {
  return `${roles.tank}T · ${roles.healer}H · ${roles.melee}M · ${roles.ranged}R`;
}
