import 'server-only';

import { db } from '@/lib/db';
import type { WowClass } from '@/lib/design/class-colors';
import { lootEnabled } from '@/lib/flags';
import { toItemView, type ItemView } from '@/lib/loot-items';
import type { LootMethod } from '@/lib/loot-rules';
import { getSession } from '@/lib/session';

export type MemberAwardView = {
  id: string;
  item: ItemView;
  characterId: string | null;
  characterName: string | null;
  wowClass: WowClass | null;
  method: LootMethod;
  roll: number | null;
  bossName: string | null;
};
export type RaidLootView = { awards: MemberAwardView[]; startsAt: string; endsAt: string; live: boolean };

/** Authenticate at the data boundary; never reuse the officer log's wider projection. */
export async function loadMemberRaidLoot(raidId: string): Promise<RaidLootView | null> {
  if (!lootEnabled()) return null;
  const session = await getSession();
  if (!session || !['member', 'officer'].includes(session.role)) return null;
  const raid = await db.raid.findUnique({
    where: { id: raidId },
    select: { startsAt: true, durationMin: true, cancelledAt: true, templateId: true },
  });
  const now = Date.now();
  if (!raid || raid.cancelledAt || !raid.templateId || now < raid.startsAt.getTime()) return null;
  // Match the reserves section: the raid's tier must still have a loot table.
  if (!await db.lootTableEntry.count({ where: { boss: { templateId: raid.templateId } } })) return null;
  const rows = await db.lootAward.findMany({
    where: { raidId, voidedAt: null },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true, characterName: true, method: true, roll: true, bossName: true,
      character: { select: { id: true, name: true, class: true } },
      item: { select: { id: true, name: true, quality: true, icon: true, tooltipHtml: true } },
    },
  });
  const end = raid.startsAt.getTime() + raid.durationMin * 60_000;
  return {
    startsAt: raid.startsAt.toISOString(), endsAt: new Date(end).toISOString(), live: now < end,
    awards: rows.map((r) => {
      const bank = r.method === 'DISENCHANT_BANK';
      return {
        id: r.id, item: toItemView(r.item),
        characterId: bank ? null : r.character?.id ?? null,
        characterName: bank ? null : r.character?.name ?? r.characterName,
        wowClass: !bank && r.character ? r.character.class.toLowerCase() as WowClass : null,
        method: r.method, roll: bank ? null : r.roll, bossName: r.bossName,
      };
    }),
  };
}
