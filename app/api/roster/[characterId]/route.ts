import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { editCharacter, removeCharacter } from '@/lib/characters';
import { setRankFromWeb } from '@/lib/roles-sync';
import { OFFICER_RANK_ERROR } from '@/content/roster-editor';
import { parseCharacterInput } from '@/lib/roster-edit';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

type Params = { params: Promise<{ characterId: string }> };

async function officer() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit the roster.' }, { status: 403, headers: NO_STORE });
  return null;
}

/** PATCH /api/roster/[characterId] — edit a character; only mains can change rank (officers). */
export async function PATCH(request: Request, { params }: Params) {
  const denied = await officer();
  if (denied) return denied;
  const { characterId } = await params;
  const existing = await db.character.findUnique({ where: { id: characterId }, select: { userId: true, isMain: true, user: { select: { rank: true } } } });
  if (!existing) return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });
  const body: unknown = await request.json().catch(() => null);
  let rank: 'RAIDER' | 'TRIAL' | 'SOCIAL' | 'OFFICER' | undefined;
  if (existing.isMain) {
    const parsed = parseCharacterInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
    // Check before editing: the form can neither grant nor remove Discord's officer rank.
    if ((parsed.value.rank === 'officer') !== (existing.user.rank === 'OFFICER')) {
      return NextResponse.json({ error: OFFICER_RANK_ERROR }, { status: 400, headers: NO_STORE });
    }
    rank = parsed.value.rank.toUpperCase() as Uppercase<typeof parsed.value.rank>;
  }
  const result = await editCharacter(existing.userId, characterId, body);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  if (rank && rank !== 'OFFICER') await setRankFromWeb(existing.userId, rank);
  return NextResponse.json({ id: result.character.id, name: result.character.name }, { headers: NO_STORE });
}

/** DELETE /api/roster/[characterId] — take a character off the roster (officers). The member and their rank stay. */
export async function DELETE(_request: Request, { params }: Params) {
  const denied = await officer();
  if (denied) return denied;
  const { characterId } = await params;
  const existing = await db.character.findUnique({ where: { id: characterId }, select: { userId: true } });
  if (!existing) return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });
  const result = await removeCharacter(existing.userId, characterId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  return NextResponse.json({ id: result.character.id, name: result.character.name }, { headers: NO_STORE });
}
