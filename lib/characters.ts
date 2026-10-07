import 'server-only';

import { db } from '@/lib/db';
import { Prisma, type Character } from '@/lib/generated/prisma/client';
import { parseCharacterInput } from '@/lib/roster-edit';
import { refreshPostedRaidsForCharacter } from '@/lib/roles-sync';

export type CharacterResult =
  | { status: 200 | 201; character: Character }
  | { status: 400 | 404 | 409; error: string };
const failure = (status: 400 | 404 | 409, error: string): CharacterResult => ({ status, error });
const missing = () => failure(404, 'No such character.');
const nameTaken = (own: boolean) => failure(409, own
  ? 'You already have a character with that name.'
  : 'That name is taken by another member.');

/** Retry the whole transaction: a unique failure may be either name index or a lost race. */
async function change(run: (tx: Prisma.TransactionClient) => Promise<CharacterResult>): Promise<CharacterResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)
        || !['P2002', 'P2034', 'P2025'].includes(error.code)) throw error;
      if (attempt === 3) return failure(409, 'Characters changed while you were editing. Try again.');
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
  if (!parsed.ok) return failure(400, parsed.error);
  return change(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { rank: true, characters: true } });
    if (!user) return failure(404, 'No such member.');
    if (!user.characters.some((c) => c.isMain)) return failure(409, 'Set a main first.');
    const named = await tx.character.findFirst({ where: { name: { equals: parsed.value.name, mode: 'insensitive' } } });
    if (named) {
      // Only a previous alt add is a retry; a main with this name is an own-name conflict.
      if (named.userId === userId && !named.isMain) return { status: 200, character: named };
      return nameTaken(named.userId === userId);
    }
    if (user.characters.length >= 8) return failure(409, 'You can have up to 8 characters.');
    const character = await tx.character.create({ data: { ...parsed.value, userId, isMain: false, rank: user.rank } });
    return { status: 201, character };
  });
}

export async function editCharacter(userId: string, characterId: string, input: unknown): Promise<CharacterResult> {
  const parsed = fields(input);
  if (!parsed.ok) return failure(400, parsed.error);
  return change(async (tx) => {
    const existing = await tx.character.findFirst({ where: { id: characterId, userId } });
    if (!existing) return missing();
    const named = await tx.character.findFirst({ where: { id: { not: characterId }, name: { equals: parsed.value.name, mode: 'insensitive' } } });
    if (named) return nameTaken(named.userId === userId);
    const character = await tx.character.update({ where: { id: characterId }, data: parsed.value });
    if (existing.raidRole !== character.raidRole) await refreshPostedRaidsForCharacter(existing, tx);
    return { status: 200, character };
  });
}

export async function removeCharacter(userId: string, characterId: string): Promise<CharacterResult> {
  return change(async (tx) => {
    const existing = await tx.character.findFirst({ where: { id: characterId, userId } });
    if (!existing) return missing();
    if (existing.isMain && await tx.character.count({ where: { userId, id: { not: characterId } } })) {
      return failure(409, 'Make another character the main first.');
    }
    // Select and queue before SetNull erases the chosen character. Jobs and deletion are atomic.
    await refreshPostedRaidsForCharacter(existing, tx);
    const character = await tx.character.delete({ where: { id: characterId } });
    return { status: 200, character };
  });
}
