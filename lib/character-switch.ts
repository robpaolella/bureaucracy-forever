import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { lootEnabled } from '@/lib/flags';
import { blockedItemIds, lockReserveTier, winLimits } from '@/lib/loot-blocks';
import { hrAwardsFor, signupAnswer } from '@/lib/loot-data';
import { hrBlocked, REASONS, winLimitOf, type Refusal, type ReserveKind } from '@/lib/loot-rules';
import { enqueue } from '@/lib/outbox';
import { characterBrought, MAIN_CHARACTER } from '@/lib/signup-character';
import { countsForBars, raidClosed, REASONS as SIGNUP_REASONS, type Actor } from '@/lib/signup-rules';

type SwitchInput = { raidId: string; userId: string; characterId: string; actor: Actor; officerOverride?: boolean };
export type RemovedReserve = { kind: ReserveKind; itemId: number; itemName: string; reason: string };

/** Standalone entry point. Call the transaction form when composing with a reserve save. */
export async function switchCharacter(input: SwitchInput) {
  return db.$transaction((tx) => switchCharacterInTransaction(tx, input), { isolationLevel: 'ReadCommitted' });
}

/**
 * Caller authorizes the target user. Use READ COMMITTED; acquire the tier lock before
 * any reserve reads/writes, including in callers composing a save. Refusals write nothing.
 * The sign-up row lock also serializes switches on raids without a loot tier.
 */
export async function switchCharacterInTransaction(tx: Prisma.TransactionClient, input: SwitchInput) {
  const refuse = (status: Refusal['status'], reason: string): Refusal => ({ ok: false, status, reason });
  if (input.actor.role === 'social') return refuse(403, SIGNUP_REASONS.social);
  const raid = await tx.raid.findUnique({ where: { id: input.raidId } });
  if (!raid) return refuse(404, 'No such raid.');
  if (raid.templateId) await lockReserveTier(tx, raid.templateId);
  await tx.$queryRaw`SELECT "id" FROM "Signup" WHERE "raidId" = ${input.raidId} AND "userId" = ${input.userId} FOR UPDATE`;
  const signup = await tx.signup.findUnique({
    where: { raidId_userId: { raidId: input.raidId, userId: input.userId } },
    include: { character: { select: MAIN_CHARACTER.select }, user: { select: { role: true, characters: MAIN_CHARACTER } } },
  });
  if (!signup || !signupAnswer(signup.response).eligible) return refuse(409, REASONS.notEligible);
  if (signup.user.role === 'SOCIAL') return refuse(403, SIGNUP_REASONS.social);
  const character = await tx.character.findFirst({ where: { id: input.characterId, userId: input.userId }, select: MAIN_CHARACTER.select });
  if (!character) return refuse(403, REASONS.notYourCharacter);
  const previous = characterBrought(signup);
  const removed: RemovedReserve[] = [];
  // A legacy null already bringing the main is a true no-op, even after the lock.
  if (previous?.id === character.id) return { ok: true as const, character, removed };
  const now = new Date();
  const status = raid.cancelledAt ? 'CANCELLED' : raid.startsAt.getTime() + raid.durationMin * 60_000 < now.getTime() ? 'DONE' : raid.status;
  const stop = raidClosed({ ...raid, status }, now, input.actor.role === 'officer' && input.officerOverride === true);
  if (stop) return stop;

  const where = { raidId: input.raidId, userId: input.userId };
  const reserves = await tx.reserve.findMany({ where, include: { item: { select: { name: true } } }, orderBy: { kind: 'asc' } });
  const hasTable = lootEnabled() && raid.templateId && reserves.length > 0
    && await tx.lootTableEntry.count({ where: { boss: { templateId: raid.templateId } } }) > 0;
  if (hasTable && raid.templateId) {
    const [blocked, limits, awards] = await Promise.all([
      blockedItemIds(raid.templateId, tx), winLimits(raid.templateId, tx), hrAwardsFor([character.id], tx),
    ]);
    for (const reserve of reserves) {
      const reason = hrBlocked(character.id, reserve.itemId, awards, [], winLimitOf(reserve.itemId, limits))
        ? REASONS.hrReceived : blocked.has(reserve.itemId) ? REASONS.itemBlocked : null;
      if (reason) removed.push({ kind: reserve.kind, itemId: reserve.itemId, itemName: reserve.item.name, reason });
    }
  }
  if (removed.length) await tx.reserve.deleteMany({ where: { ...where, itemId: { in: removed.map((r) => r.itemId) } } });
  await tx.reserve.updateMany({ where, data: { characterId: character.id } });
  await tx.signup.update({ where: { id: signup.id }, data: { characterId: character.id } });
  const counts = (role: string | null) => countsForBars([{ standing: signup.standing, response: signupAnswer(signup.response).response, role }]);
  const before = counts(previous?.raidRole.toLowerCase() ?? null), after = counts(character.raidRole.toLowerCase());
  if (raid.discordThreadId && Object.keys(before).some((role) => before[role] !== after[role])) {
    await enqueue('raid.update', { raidId: raid.id }, tx);
  }
  return { ok: true as const, character, removed };
}
