import { NextResponse } from 'next/server';
import { switchCharacter } from '@/lib/character-switch';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { jsonBody, NO_STORE } from '../../../../_officer';

/** PUT { characterId, forUserId? }; only officers may choose for another member. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role === 'social') return NextResponse.json({ error: 'Social members do not sign up for raids.' }, { status: 403, headers: NO_STORE });
  const body = ((await jsonBody(request)) ?? {}) as Record<string, unknown>;
  if (typeof body.characterId !== 'string' || !body.characterId.trim()) return NextResponse.json({ error: 'Pick a character.' }, { status: 400, headers: NO_STORE });
  if (body.forUserId !== undefined && (typeof body.forUserId !== 'string' || !body.forUserId.trim())) return NextResponse.json({ error: 'Pick a member.' }, { status: 400, headers: NO_STORE });
  const forUserId = typeof body.forUserId === 'string' ? body.forUserId : null;
  const officer = session.role === 'officer';
  if (forUserId && !officer) return NextResponse.json({ error: 'Officers only.' }, { status: 403, headers: NO_STORE });
  const target = await db.user.findUnique({ where: forUserId ? { id: forUserId } : { discordId: session.discordId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: forUserId ? 'No such member.' : 'Sign up as Accept or Tentative to reserve.' }, { status: forUserId ? 404 : 409, headers: NO_STORE });
  const { id: raidId } = await params;
  const result = await switchCharacter({ raidId, userId: target.id, characterId: body.characterId, actor: { role: session.role }, officerOverride: officer });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: result.status, headers: NO_STORE });
  return NextResponse.json({ character: result.character, removed: result.removed }, { headers: NO_STORE });
}
