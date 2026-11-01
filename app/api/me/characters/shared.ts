import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { CharacterResult } from '@/lib/characters';

export const NO_STORE = { 'Cache-Control': 'private, no-store' };
export const error = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: NO_STORE });

export async function viewer() {
  const session = await getSession();
  if (!session) return { denied: error('Log in first.', 401) };
  // Guild Member or Officer, re-read from Discord hourly (lib/auth/token-roles.ts).
  if (session.role !== 'member' && session.role !== 'officer') return { denied: error('Only guild members can change characters.', 403) };
  const user = await db.user.findUnique({ where: { discordId: session.discordId }, select: { id: true } });
  return { user };
}

export function resultResponse(result: CharacterResult) {
  if ('error' in result) {
    if (result.reason === 'main') return error('Make another character your main before removing this one.', 409);
    return error(result.reason === 'no_main' ? 'Set your main first.' : result.error, result.status);
  }
  return NextResponse.json({ id: result.character.id, name: result.character.name }, { status: result.status, headers: NO_STORE });
}

/** The signed-in Guild Member's own character; the rules re-check ownership in their transaction. */
export async function ownCharacter(characterId: string) {
  const v = await viewer();
  if (v.denied) return { denied: v.denied };
  const character = await db.character.findUnique({ where: { id: characterId }, select: { userId: true } });
  if (!character) return { denied: error('No such character.', 404) };
  if (character.userId !== v.user?.id) return { denied: error('You can only change your own characters.', 403) };
  return { userId: character.userId };
}
