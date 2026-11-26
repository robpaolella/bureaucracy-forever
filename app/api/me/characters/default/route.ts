import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { error, NO_STORE, viewer } from '../shared';

/**
 * PUT /api/me/characters/default — `{ characterId: string | null }`. Sets the signed-in
 * Guild Member's default sign-up character, or clears it with null. The ownership check
 * is part of the write itself, so someone else's character, or one deleted meanwhile,
 * answers 404 like one that never existed.
 */
export async function PUT(request: Request) {
  const v = await viewer();
  if (v.denied) return v.denied;
  const body: unknown = await request.json().catch(() => null);
  const characterId = body !== null && typeof body === 'object' && 'characterId' in body ? body.characterId : undefined;
  if (characterId !== null && (typeof characterId !== 'string' || !characterId.trim())) return error('Pick a character, or none.', 400);
  if (characterId === null) {
    if (v.user) await db.user.update({ where: { id: v.user.id }, data: { defaultCharacterId: null } });
    return NextResponse.json({ defaultCharacterId: null }, { headers: NO_STORE });
  }
  if (!v.user) return error('No such character.', 404);
  try {
    const { count } = await db.user.updateMany({ where: { id: v.user.id, characters: { some: { id: characterId } } }, data: { defaultCharacterId: characterId } });
    if (count === 0) return error('No such character.', 404);
  } catch (e) {
    // The character was deleted between the ownership check and the foreign key check.
    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2003') return error('No such character.', 404);
    throw e;
  }
  return NextResponse.json({ defaultCharacterId: characterId }, { headers: NO_STORE });
}
