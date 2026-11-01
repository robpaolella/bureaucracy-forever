/**
 * The helper's raids list (ADDON-SPEC section 7.5): every raid, for any officer, that starts
 * within the next 12 hours or is under way, cancelled ones left out, soonest first.
 */
import 'server-only';

import { raidCode } from '@/lib/addon-snapshot';
import type { SiteEnv } from '@/lib/addon-operations';
import { db } from '@/lib/db';

export const RAIDS_AHEAD_MS = 12 * 60 * 60_000;
/** How far back to look for a raid still under way; no raid runs anywhere near this long. */
const LONGEST_RAID_MS = 7 * 24 * 60 * 60_000;

export type HelperRaid = { id: string; code: string; name: string; startsAt: number; durationMin: number; hasLootTable: boolean; instance?: number };

type Row = { id: string; name: string; startsAt: Date; durationMin: number; cancelledAt: Date | null; hasLootTable: boolean; instance?: number | null };

/** The list from rows already fetched; the rule itself, kept apart from the query. */
export function helperRaids(rows: Row[], env: SiteEnv, now: Date): HelperRaid[] {
  const t = now.getTime();
  return rows
    .filter((r) => !r.cancelledAt && r.startsAt.getTime() <= t + RAIDS_AHEAD_MS && t < r.startsAt.getTime() + r.durationMin * 60_000)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      code: raidCode(env, r.id),
      name: r.name,
      // Seconds, as the snapshot's startsAt (section 3.1).
      startsAt: Math.floor(r.startsAt.getTime() / 1000),
      durationMin: r.durationMin,
      hasLootTable: r.hasLootTable,
      ...(r.instance ? { instance: r.instance } : {}),
    }));
}

export async function listHelperRaids(env: SiteEnv, now: Date = new Date()): Promise<HelperRaid[]> {
  const rows = await db.raid.findMany({
    where: { cancelledAt: null, startsAt: { lte: new Date(now.getTime() + RAIDS_AHEAD_MS), gt: new Date(now.getTime() - LONGEST_RAID_MS) } },
    select: {
      id: true, name: true, startsAt: true, durationMin: true, cancelledAt: true,
      // A loot table is a tier with at least one item, as loadLootTable counts it.
      template: { select: { instance: true, lootBosses: { where: { entries: { some: {} } }, select: { id: true }, take: 1 } } },
    },
  });
  return helperRaids(rows.map(({ template, ...r }) => ({ ...r, hasLootTable: (template?.lootBosses.length ?? 0) > 0, instance: template?.instance })), env, now);
}
