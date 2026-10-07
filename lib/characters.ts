import 'server-only';

import { db } from '@/lib/db';
import { Prisma, type Character } from '@/lib/generated/prisma/client';
import { parseCharacterInput } from '@/lib/roster-edit';
import { refreshPostedRaidsForCharacter } from '@/lib/roles-sync';

export type CharacterFailureReason = 'no_main' | 'name_taken' | 'limit' | 'main' | 'invalid' | 'not_found' | 'busy';

export type CharacterResult =
  | { status: 200 | 201; character: Character }
  | { status: 400 | 404 | 409; reason: CharacterFailureReason; error: string };
const failure = (status: 400 | 404 | 409, reason: CharacterFailureReason, error: string): CharacterResult => ({ status, reason, error });
const missing = () => failure(404, 'not_found', 'No such character.');
const nameTaken = (own: boolean) => failure(409, 'name_taken', own
  ? 'You already have a character with that name.'
  : 'That name is taken by another member.');

/** Retry the whole transaction: a unique failure may be either name index or a lost race. */
async function change(run: (tx: Prisma.TransactionClient) => Promise<CharacterResult>): Promise<CharacterResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const knownRace = error instanceof Prisma.PrismaClientKnownRequestError
        && ['P2002', 'P2034', 'P2025'].includes(error.code);
      // Prisma's pg adapter can expose a COMMIT-time serialization failure directly.
      const commitRace = error instanceof Error && error.name === 'DriverAdapterError'
        && error.cause !== null && typeof error.cause === 'object'
        && 'kind' in error.cause && error.cause.kind === 'TransactionWriteConflict';
      if (!knownRace && !commitRace) throw error;
      if (attempt === 3) return failure(409, 'busy', 'Characters changed while you were editing. Try again.');
    }
  }
}

/** Shared validation; rank is deliberately not writable through these rules. */
function fields(input: unknown) {
  const parsed = parseCharacterInput({ ...(input && typeof input === 'object' ? input : {}), rank: 'social' });
  if (!parsed.ok) return parsed;
  const v = parsed.value;
  return { ok: true as const, value: {
    name: v.name, class: v.wowClass.toUpperCase() as Uppercase<typeof v.wowClass>,
    spec: v.spec, raidRole: v.role.toUpperCase() as Uppercase<typeof v.role>,
  } };
}

/** Callers authorize the member first. userId also scopes edits/deletes against cross-member ids. */
export async function addAlt(userId: string, input: unknown): Promise<CharacterResult> {
  const parsed = fields(input);
  if (!parsed.ok) return failure(400, 'invalid', parsed.error);
  return change(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { rank: true, characters: true } });
    if (!user) return failure(404, 'not_found', 'No such member.');
    if (!user.characters.some((c) => c.isMain)) return failure(409, 'no_main', 'Set a main first.');
    const named = await tx.character.findFirst({ where: { name: { equals: parsed.value.name, mode: 'insensitive' } } });
    if (named) {
      // Only a previous alt add is a retry; a main with this name is an own-name conflict.
      if (named.userId === userId && !named.isMain) return { status: 200, character: named };
      return nameTaken(named.userId === userId);
    }
    if (user.characters.length >= 8) return failure(409, 'limit', 'You can have up to 8 characters.');
    const character = await tx.character.create({ data: { ...parsed.value, userId, isMain: false, rank: user.rank } });
    return { status: 201, character };
  });
}

export async function editCharacter(userId: string, characterId: string, input: unknown, options: { altOnly?: boolean } = {}): Promise<CharacterResult> {
  const parsed = fields(input);
  if (!parsed.ok) return failure(400, 'invalid', parsed.error);
  return change(async (tx) => {
    const existing = await tx.character.findFirst({ where: { id: characterId, userId } });
    if (!existing) return missing();
    if (existing.isMain && options.altOnly) return failure(409, 'main', 'Only alt characters can be edited.');
    const named = await tx.character.findFirst({ where: { id: { not: characterId }, name: { equals: parsed.value.name, mode: 'insensitive' } } });
    if (named) return nameTaken(named.userId === userId);
    const character = await tx.character.update({ where: { id: characterId }, data: parsed.value });
    if (existing.raidRole !== character.raidRole) await refreshPostedRaidsForCharacter(existing, tx);
    return { status: 200, character };
  });
}

/** Officer callers authorize first; ownership and rank come from the stored character. */
export async function changeMain(characterId: string): Promise<CharacterResult> {
  return change(async (tx) => {
    const chosen = await tx.character.findUnique({ where: { id: characterId } });
    if (!chosen) return missing();
    if (chosen.isMain) return { status: 200, character: chosen };
    const user = await tx.user.findUniqueOrThrow({ where: { id: chosen.userId }, select: { rank: true } });
    const oldMain = await tx.character.findFirst({ where: { userId: chosen.userId, isMain: true } });
    if (!oldMain) return failure(409, 'no_main', 'Set a main first.');
    // Pin legacy choices before their current-main fallback would change, including past raids.
    await tx.signup.updateMany({ where: { userId: chosen.userId, characterId: null }, data: { characterId: oldMain.id } });
    // The partial unique index is checked per statement: demote before promoting.
    await tx.character.update({ where: { id: oldMain.id }, data: { isMain: false } });
    // These roster values describe the member, not the character they choose to bring.
    const character = await tx.character.update({ where: { id: characterId }, data: {
      isMain: true, rank: user.rank, joinedAt: oldMain.joinedAt, attendance: oldMain.attendance,
    } });
    // Stored choices and their roles are unchanged, so no posted raid needs refreshing.
    return { status: 200, character };
  });
}

export async function removeCharacter(userId: string, characterId: string, options: { altOnly?: boolean } = {}): Promise<CharacterResult> {
  return change(async (tx) => {
    const existing = await tx.character.findFirst({ where: { id: characterId, userId } });
    if (!existing) return missing();
    if (existing.isMain && options.altOnly) return failure(409, 'main', 'Only alt characters can be removed.');
    if (existing.isMain && await tx.character.count({ where: { userId, id: { not: characterId } } })) {
      return failure(409, 'main', 'Make another character the main first.');
    }
    // Select and queue before SetNull erases the chosen character. Jobs and deletion are atomic.
    await refreshPostedRaidsForCharacter(existing, tx);
    const character = await tx.character.delete({ where: { id: characterId } });
    return { status: 200, character };
  });
}
