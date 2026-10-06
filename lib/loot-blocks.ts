import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { RESERVE_LOCK_MINUTES } from '@/lib/loot-rules';

/**
 * Shared lock for reserve saves and block changes, including #135's future removal action.
 * Acquire before reading settings/holders, and hold through all writes. READ COMMITTED
 * ensures a waiter sees the previous owner's committed setting. A save ordered before
 * a block becomes an existing reserve that refuses the block; blocking never removes reserves.
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
 * Reserves on this item for raids of this tier whose reserve lock hasn't passed, cancelled
 * raids included (they could be un-cancelled). Locked and past raids keep their reserves.
 */
export async function unlockedHolderCount(client: Pick<Prisma.TransactionClient, 'reserve'>, templateId: string, itemId: number, now: Date): Promise<number> {
  const lockedBefore = new Date(now.getTime() + RESERVE_LOCK_MINUTES * 60_000);
  return client.reserve.count({ where: { itemId, raid: { templateId, startsAt: { gt: lockedBefore } } } });
}

export type BlockResult = { ok: true } | { ok: false; holders: number };

/**
 * Server-only storage operation; callers must authorize officers before exposing an action.
 * Blocking is refused while anyone holds the item on a raid that hasn't locked, checked under
 * the tier lock so a reserve saved at the same moment is either seen here or refused there.
 * Unblocking never restores anything.
 */
export async function setItemBlocked(templateId: string, itemId: number, blocked: boolean, now = new Date()): Promise<BlockResult> {
  return db.$transaction(async (tx) => {
    await lockReserveTier(tx, templateId);
    if (blocked) {
      const holders = await unlockedHolderCount(tx, templateId, itemId, now);
      if (holders > 0) return { ok: false, holders };
    }
    await tx.lootReserveSetting.upsert({
      where: { templateId_itemId: { templateId, itemId } },
      create: { templateId, itemId, blocked },
      update: { blocked },
    });
    return { ok: true } as const;
  }, { isolationLevel: 'ReadCommitted' });
}
