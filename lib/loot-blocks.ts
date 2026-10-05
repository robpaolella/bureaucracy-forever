import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';

/**
 * Shared lock for reserve saves and block changes, including #123's future removal action.
 * Acquire before reading settings/holders, and hold through all writes. READ COMMITTED
 * ensures a waiter sees the previous owner's committed setting. A save ordered before
 * a block becomes an existing reserve; blocking here never removes existing reserves.
 */
export async function lockReserveTier(tx: Prisma.TransactionClient, templateId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "RaidTemplate" WHERE "id" = ${templateId} FOR UPDATE`;
}

/** Missing settings mean unblocked. Pass the locked transaction when enforcing a save. */
export async function blockedItemIds(templateId: string, client: Pick<Prisma.TransactionClient, 'lootReserveSetting'> = db): Promise<Set<number>> {
  const rows = await client.lootReserveSetting.findMany({ where: { templateId, blocked: true }, select: { itemId: true } });
  return new Set(rows.map((row) => row.itemId));
}

/** Server-only storage operation; callers must authorize officers before exposing an action. */
export async function setItemBlocked(templateId: string, itemId: number, blocked: boolean): Promise<void> {
  await db.$transaction(async (tx) => {
    await lockReserveTier(tx, templateId);
    await tx.lootReserveSetting.upsert({
      where: { templateId_itemId: { templateId, itemId } },
      create: { templateId, itemId, blocked },
      update: { blocked },
    });
  }, { isolationLevel: 'ReadCommitted' });
}
