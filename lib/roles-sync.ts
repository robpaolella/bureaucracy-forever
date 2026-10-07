import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import type { Rank } from '@/lib/generated/prisma/enums';
import { enqueue } from '@/lib/outbox';
import { rankRoleIdsFromEnv, roleChangesForRank } from '@/lib/rank-rules';

/**
 * A rank written on the web (docs/04 § Roster, SYNC-SPEC §3): the user's rank changes, the
 * main character mirrors it, and the Discord Raider / Trial / Social roles follow through
 * member.roles.sync. Officer is never touched. A no-op when the rank is already that.
 */
export type RankWrite = 'changed' | 'unchanged' | 'officer' | 'missing';

export async function setRankFromWeb(userId: string, rank: Rank): Promise<RankWrite> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true, rank: true } });
  if (!user) return 'missing';
  if (user.rank === rank) return 'unchanged';
  // Officer comes from the Discord Officer role alone (§9.6): neither granted nor taken away here.
  if (rank === 'OFFICER' || user.rank === 'OFFICER') return 'officer';
  // The job is written with the rank, so a failure leaves neither a rank without its roles nor the reverse.
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { rank, trialStartedAt: rank === 'TRIAL' ? new Date() : null, trialNudgedAt: null, trialCheckInAt: null } });
    await tx.character.updateMany({ where: { userId, isMain: true }, data: { rank } });
    const changes = rankRoleChanges(rank);
    if (changes) await enqueue('member.roles.sync', { discordId: user.discordId, ...changes }, tx);
  });
  return 'changed';
}

/** The Discord side of a rank, or null when the role ids are not configured or nothing would change. */
function rankRoleChanges(rank: Rank): { add: string[]; remove: string[] } | null {
  try {
    const changes = roleChangesForRank(rank, rankRoleIdsFromEnv());
    return changes.add.length || changes.remove.length ? changes : null;
  } catch {
    return null;
  }
}

/** Only raids bringing this character; legacy null choices bring the current main. */
export async function refreshPostedRaidsForCharacter(
  character: { id: string; userId: string; isMain: boolean },
  tx: Prisma.TransactionClient,
): Promise<number> {
  const choices: Prisma.SignupWhereInput[] = [{ characterId: character.id }];
  if (character.isMain) choices.push({ characterId: null });
  const raids = await tx.raid.findMany({ where: {
    status: { in: ['SCHEDULED', 'LOCKED'] }, discordThreadId: { not: null },
    signups: { some: { userId: character.userId, OR: choices } },
  }, select: { id: true } });
  for (const raid of raids) await enqueue('raid.update', { raidId: raid.id }, tx);
  return raids.length;
}

/** Refresh every posted active raid the member is signed up on. */
export async function refreshPostedRaidsFor(userId: string): Promise<number> {
  const raids = await db.raid.findMany({ where: { status: { in: ['SCHEDULED', 'LOCKED'] }, discordThreadId: { not: null }, signups: { some: { userId } } }, select: { id: true } });
  for (const r of raids) await enqueue('raid.update', { raidId: r.id });
  return raids.length;
}
