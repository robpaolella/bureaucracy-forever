import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { RESERVE_LOCK_MINUTES } from '@/lib/loot-rules';

/**
 * Shared lock for reserve saves and block changes. Acquire before reading settings/holders,
 * and hold through all writes. READ COMMITTED ensures a waiter sees the previous owner's
 * committed setting. A save ordered before a block becomes a holder the officer hasn't seen,
 * which refuses the block; a block only removes the holders the officer confirmed.
 */
export async function lockReserveTier(tx: Prisma.TransactionClient, templateId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "RaidTemplate" WHERE "id" = ${templateId} FOR NO KEY UPDATE`;
}

/** Missing settings mean unblocked. Pass the locked transaction when enforcing a save. */
export async function blockedItemIds(templateId: string, client: Pick<Prisma.TransactionClient, 'lootReserveSetting'> = db): Promise<Set<number>> {
  const rows = await client.lootReserveSetting.findMany({ where: { templateId, blocked: true }, select: { itemId: true } });
  return new Set(rows.map((row) => row.itemId));
}

/**
 * Reserves on this tier's raids whose reserve lock hasn't passed, cancelled raids included
 * (they could be un-cancelled). Locked and past raids keep their reserves.
 */
function unlockedWhere(templateId: string, itemId: number, now: Date) {
  const lockedBefore = new Date(now.getTime() + RESERVE_LOCK_MINUTES * 60_000);
  return { itemId, raid: { templateId, startsAt: { gt: lockedBefore } } };
}

/**
 * One reserve a block would remove. `key` names the raid, character and slot rather than the
 * row, because saving reserves rewrites unchanged rows; the officer confirms what they saw.
 */
export type Holder = { key: string; character: string; kind: 'HR' | 'SR'; raid: { id: string; name: string; startsAt: string; cancelled: boolean } };

export async function unlockedHolders(client: Pick<Prisma.TransactionClient, 'reserve'>, templateId: string, itemId: number, now: Date): Promise<Holder[]> {
  const rows = await client.reserve.findMany({
    where: unlockedWhere(templateId, itemId, now),
    select: { raidId: true, characterId: true, kind: true, character: { select: { name: true } }, raid: { select: { name: true, startsAt: true, cancelledAt: true } } },
    orderBy: [{ raid: { startsAt: 'asc' } }, { raidId: 'asc' }, { character: { name: 'asc' } }],
  });
  return rows.map((r) => ({
    key: `${r.raidId}:${r.characterId}:${r.kind}`,
    character: r.character.name,
    kind: r.kind,
    raid: { id: r.raidId, name: r.raid.name, startsAt: r.raid.startsAt.toISOString(), cancelled: r.raid.cancelledAt !== null },
  }));
}

export type BlockResult = { ok: true; removed: number } | { ok: false; holders: Holder[] };

/**
 * Server-only; callers must authorize officers. Blocks the item and removes its reserves on
 * unlocked raids in one transaction under the tier lock, but only if the officer saw every one:
 * each is among `confirmed` (holder keys; none for a direct block). Otherwise writes nothing and
 * returns the current holders, so a reserve saved meanwhile is never removed unseen.
 */
export async function blockItem(templateId: string, itemId: number, confirmed: readonly string[], now = new Date()): Promise<BlockResult> {
  return db.$transaction(async (tx) => {
    await lockReserveTier(tx, templateId);
    const holders = await unlockedHolders(tx, templateId, itemId, now);
    const seen = new Set(confirmed);
    // Reserves dropped since don't matter; one the officer hasn't seen refuses the block.
    if (holders.some((h) => !seen.has(h.key))) return { ok: false, holders };
    const { count } = holders.length ? await tx.reserve.deleteMany({ where: unlockedWhere(templateId, itemId, now) }) : { count: 0 };
    await tx.lootReserveSetting.upsert({
      where: { templateId_itemId: { templateId, itemId } },
      create: { templateId, itemId, blocked: true },
      update: { blocked: true },
    });
    return { ok: true, removed: count } as const;
  }, { isolationLevel: 'ReadCommitted' });
}

/**
 * Blocking here is a direct block (no holders confirmed): refused, with a holder count, while
 * anyone holds the item on a raid that hasn't locked. Unblocking never restores anything.
 */
export async function setItemBlocked(templateId: string, itemId: number, blocked: boolean, now = new Date()): Promise<{ ok: true } | { ok: false; holders: number }> {
  if (blocked) {
    const result = await blockItem(templateId, itemId, [], now);
    return result.ok ? { ok: true } : { ok: false, holders: result.holders.length };
  }
  return db.$transaction(async (tx) => {
    await lockReserveTier(tx, templateId);
    await tx.lootReserveSetting.upsert({
      where: { templateId_itemId: { templateId, itemId } },
      create: { templateId, itemId, blocked: false },
      update: { blocked: false },
    });
    return { ok: true } as const;
  }, { isolationLevel: 'ReadCommitted' });
}
