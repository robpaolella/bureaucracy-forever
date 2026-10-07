import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
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

const awardSelect = {
  id: true, characterName: true, method: true, roll: true, bossName: true,
  character: { select: { id: true, name: true, class: true } },
  item: { select: { id: true, name: true, quality: true, icon: true, tooltipHtml: true } },
} satisfies Prisma.LootAwardSelect;
function memberAward(r: Prisma.LootAwardGetPayload<{ select: typeof awardSelect }>): MemberAwardView {
  const bank = r.method === 'DISENCHANT_BANK';
  return {
    id: r.id, item: toItemView(r.item),
    characterId: bank ? null : r.character?.id ?? null,
    characterName: bank ? null : r.character?.name ?? r.characterName,
    wowClass: !bank && r.character ? r.character.class.toLowerCase() as WowClass : null,
    method: r.method, roll: bank ? null : r.roll, bossName: r.bossName,
  };
}

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
    select: awardSelect,
  });
  const end = raid.startsAt.getTime() + raid.durationMin * 60_000;
  return {
    startsAt: raid.startsAt.toISOString(), endsAt: new Date(end).toISOString(), live: now < end,
    awards: rows.map(memberAward),
  };
}

export type HistoryCursor = { startsAt: string; id: string };
export type LootHistoryView = {
  raids: { id: string; name: string; startsAt: string; awards: MemberAwardView[] }[];
  next: HistoryCursor | null;
};

/** Whole raids up to 50 awards, always at least one; no older award payloads are prefetched. */
export async function loadMemberLootHistory(before: HistoryCursor | null = null): Promise<LootHistoryView | null> {
  if (!lootEnabled()) return null;
  const session = await getSession();
  if (!session || !['member', 'officer'].includes(session.role)) return null;
  return db.$transaction(async (tx) => {
    const candidates = await tx.raid.findMany({
      where: {
        cancelledAt: null, startsAt: { lte: new Date() },
        template: { lootBosses: { some: { entries: { some: {} } } } },
        lootAwards: { some: { voidedAt: null } },
        ...(before && { OR: [
          { startsAt: { lt: new Date(before.startsAt) } },
          { startsAt: new Date(before.startsAt), id: { lt: before.id } },
        ] }),
      },
      orderBy: [{ startsAt: 'desc' }, { id: 'desc' }], take: 51,
      select: { id: true, name: true, startsAt: true, _count: { select: { lootAwards: { where: { voidedAt: null } } } } },
    });
    const selected = []; let count = 0;
    for (const raid of candidates) {
      if (selected.length && count + raid._count.lootAwards > 50) break;
      selected.push(raid); count += raid._count.lootAwards;
    }
    const rows = selected.length ? await tx.lootAward.findMany({
      where: { raidId: { in: selected.map((r) => r.id) }, voidedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { ...awardSelect, raidId: true },
    }) : [];
    const raids = selected.map((r) => ({ id: r.id, name: r.name, startsAt: r.startsAt.toISOString(),
      awards: rows.filter((a) => a.raidId === r.id).map(memberAward) }));
    const last = raids.at(-1);
    return { raids, next: last && selected.length < candidates.length ? { id: last.id, startsAt: last.startsAt } : null };
  }, { isolationLevel: 'RepeatableRead' });
}
