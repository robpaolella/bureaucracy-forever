import 'server-only';

import { db } from '@/lib/db';
import type { Rank } from '@/lib/generated/prisma/enums';
import { enqueue } from '@/lib/outbox';
import { rankRoleIdsFromEnv, roleChangesForRank } from '@/lib/rank-rules';

/**
 * A rank written on the web (docs/04 § Roster, SYNC-SPEC §3): the user's rank changes, the
 * main character mirrors it, and the Discord Raider / Trial / Social roles follow through
 * member.roles.sync. Officer is never touched. A no-op when the rank is already that.
 */
export async function setRankFromWeb(userId: string, rank: Rank): Promise<{ changed: boolean }> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true, rank: true } });
  if (!user) return { changed: false };
  if (user.rank === rank) return { changed: false };
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { rank, trialStartedAt: rank === 'TRIAL' ? new Date() : null, trialNudgedAt: null } }),
    db.character.updateMany({ where: { userId, isMain: true }, data: { rank } }),
  ]);
  await pushRankRoles(user.discordId, rank);
  return { changed: true };
}

/** Queue the Discord side of a rank, if the role ids are configured. */
export async function pushRankRoles(discordId: string, rank: Rank): Promise<void> {
  let changes;
  try {
    changes = roleChangesForRank(rank, rankRoleIdsFromEnv());
  } catch {
    return;
  }
  if (changes.add.length === 0 && changes.remove.length === 0) return;
  await enqueue('member.roles.sync', { discordId, ...changes });
}
