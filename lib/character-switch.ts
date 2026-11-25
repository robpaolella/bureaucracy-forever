import 'server-only';

import { db } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma/client';
import { COMPOSITION_ROLES } from '@/lib/design/class-colors';
import { lootEnabled } from '@/lib/flags';
import { blockedItemIds, lockReserveTier, winLimits } from '@/lib/loot-blocks';
import { hrAwardsFor, signupAnswer } from '@/lib/loot-data';
import { hrBlocked, REASONS, winLimitOf, type Refusal, type ReserveKind } from '@/lib/loot-rules';
import { enqueue } from '@/lib/outbox';
import { characterBrought, MAIN_CHARACTER } from '@/lib/signup-character';
import { characterToBring, countsForBars, raidClosed, REASONS as SIGNUP_REASONS, type Actor, type Existing, type Outcome } from '@/lib/signup-rules';

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
  if (raid.discordThreadId && COMPOSITION_ROLES.some((role) => before[role] !== after[role])) {
    await enqueue('raid.update', { raidId: raid.id }, tx);
  }
  return { ok: true as const, character, removed };
}

type Answered = Extract<Outcome, { ok: true }>;
type AnswerFields = { standing: Answered['standing']; response: 'ACCEPT' | 'TENTATIVE' | 'ABSENT'; source: 'WEB' | 'DISCORD'; reason: string | null; setByUserId: string | null };
type AnswerInput = {
  raid: { id: string; templateId: string | null; discordThreadId: string | null };
  userId: string;
  /** The surface's sign-up rules, run on the row as it stands under the lock. */
  decide: (existing: Existing) => Outcome;
  fields: (outcome: Answered) => AnswerFields;
  /** A character the answer chooses; must be the member's. Null brings the default rule. */
  characterId: string | null;
  /** Also make `characterId` the member's default. Only the member themself sets it. */
  makeDefault?: boolean;
  /** Said when `characterId` isn't the member's. */
  notOwned: string;
  actor: Actor;
  officerOverride?: boolean;
};
export type AnswerResult = { ok: true; outcome: Answered; characterId: string | null; removed: RemovedReserve[] } | { ok: false; status: number; reason: string };

class AnswerRefusal extends Error {
  constructor(readonly refusal: { ok: false; status: number; reason: string }) { super('Sign-up answer refused'); }
}

/** One answer per member and raid at a time, so the web and Discord can't interleave (#560). */
export async function lockSignup(tx: Prisma.TransactionClient, raidId: string, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('signup-answer'), hashtext(${`${raidId}:${userId}`}))`;
}

/**
 * Writes an Accept / Tentative / Absent from the web or Discord, then brings the chosen
 * character, or the default on a first Accept/Tentative (lib/signup-rules.ts), through
 * the switch above, and saves a new default, all in one transaction. A refusal anywhere
 * rolls the answer back. Lock order: this sign-up's lock, the reserve tier, the row.
 */
export async function answerSignup(input: AnswerInput): Promise<AnswerResult> {
  const { raid, userId } = input;
  try {
    return await db.$transaction(async (tx) => {
      await lockSignup(tx, raid.id, userId);
      const where = { raidId_userId: { raidId: raid.id, userId } };
      const row = await tx.signup.findUnique({ where, select: { standing: true, response: true } });
      const existing: Existing = row ? { standing: row.standing, response: signupAnswer(row.response).response } : null;
      const outcome = input.decide(existing);
      if (!outcome.ok) return outcome;
      if (input.characterId && !await tx.character.findFirst({ where: { id: input.characterId, userId }, select: { id: true } })) {
        return { ok: false as const, status: 400, reason: input.notOwned };
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { defaultCharacter: { select: { id: true, userId: true } }, characters: MAIN_CHARACTER } });
      const defaultId = user.defaultCharacter?.userId === userId ? user.defaultCharacter.id : null;
      const target = characterToBring(existing?.response ?? null, outcome.response, input.characterId, defaultId);
      if (target && raid.templateId) await lockReserveTier(tx, raid.templateId);
      const fields = input.fields(outcome);
      const saved = await tx.signup.upsert({
        where, create: { raidId: raid.id, userId, characterId: user.characters[0]?.id ?? null, ...fields }, update: fields,
        include: { character: { select: MAIN_CHARACTER.select }, user: { select: { characters: MAIN_CHARACTER } } },
      });
      let characterId = characterBrought(saved)?.id ?? null;
      let removed: RemovedReserve[] = [];
      if (target && target !== characterId) {
        const switched = await switchCharacterInTransaction(tx, { raidId: raid.id, userId, characterId: target, actor: input.actor, officerOverride: input.officerOverride });
        if (!switched.ok) throw new AnswerRefusal(switched);
        characterId = switched.character.id;
        removed = switched.removed;
      }
      if (input.makeDefault && input.characterId) await tx.user.update({ where: { id: userId }, data: { defaultCharacterId: input.characterId } });
      if (raid.discordThreadId) await enqueue('raid.update', { raidId: raid.id }, tx);
      return { ok: true as const, outcome, characterId, removed };
    }, { isolationLevel: 'ReadCommitted' });
  } catch (error) {
    if (error instanceof AnswerRefusal) return error.refusal;
    throw error;
  }
}
