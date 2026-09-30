/**
 * The loot log's view of this raid's awards between a save and the page refresh that
 * brings it back from the server. Pure, so the merge is unit-tested.
 */
import type { HrAward, LootMethod, RaidAward } from '@/lib/loot-rules';

export type LoggedAward = RaidAward & { id: string };
export type LoggedHr = HrAward & { id: string };
/** A record saved in this tab. */
export type LocalAward = LoggedAward & { characterId: string | null; method: LootMethod };

/**
 * Server awards plus local ones it does not show yet, minus anything voided in this tab; and
 * the HR wins likewise, so a fresh HR win blocks at once and a voided one stops blocking.
 */
export function mergeAwards(
  server: readonly LoggedAward[],
  serverHr: readonly LoggedHr[],
  local: readonly LocalAward[],
  voided: ReadonlySet<string>,
): { raidAwards: LoggedAward[]; hrAwards: HrAward[] } {
  const known = new Set(server.map((a) => a.id));
  const knownHr = new Set(serverHr.map((a) => a.id));
  const fresh = local.filter((a) => !voided.has(a.id));
  return {
    raidAwards: [...server.filter((a) => !voided.has(a.id)), ...fresh.filter((a) => !known.has(a.id))],
    hrAwards: [
      ...serverHr.filter((a) => !voided.has(a.id)),
      ...fresh.flatMap((a) => (a.method === 'HR' && a.characterId && !knownHr.has(a.id) ? [{ id: a.id, characterId: a.characterId, itemId: a.itemId }] : [])),
    ],
  };
}
