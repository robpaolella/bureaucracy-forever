import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import type { CharacterResult } from '@/lib/characters';

export const NO_STORE = { 'Cache-Control': 'private, no-store' };
export const error = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: NO_STORE });

export async function viewer() {
  const session = await getSession();
  if (!session) return { denied: error('Log in first.', 401) };
  const user = await db.user.findUnique({ where: { discordId: session.discordId }, select: { id: true } });
  return { user };
}

export function resultResponse(result: CharacterResult) {
  if ('error' in result) return error(result.reason === 'no_main' ? 'Set your main first.' : result.error, result.status);
  return NextResponse.json({ id: result.character.id, name: result.character.name }, { status: result.status, headers: NO_STORE });
}
