import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { setRankFromWeb } from '@/lib/roles-sync';
import { parseCharacterInput } from '@/lib/roster-edit';
import { getSession } from '@/lib/session';
import { toPrismaCharacter } from '../fields';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

type Params = { params: Promise<{ characterId: string }> };

async function officer() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit the roster.' }, { status: 403, headers: NO_STORE });
  return null;
}

/** PATCH /api/roster/[characterId] — change a main's name, class, spec, raid role or rank (officers). */
export async function PATCH(request: Request, { params }: Params) {
  const denied = await officer();
  if (denied) return denied;
  const { characterId } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = parseCharacterInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const existing = await db.character.findUnique({ where: { id: characterId }, select: { id: true, userId: true, rank: true, isMain: true } });
  if (!existing) return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });
  try {
    const updated = await db.character.update({ where: { id: characterId }, data: toPrismaCharacter(parsed.value), select: { id: true, name: true } });
    if (existing.isMain) await setRankFromWeb(existing.userId, parsed.value.rank.toUpperCase() as Uppercase<typeof parsed.value.rank>);
    return NextResponse.json(updated, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'That character name is already on the roster.' }, { status: 409, headers: NO_STORE });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });
    }
    throw e;
  }
}

/** DELETE /api/roster/[characterId] — take a character off the roster (officers). The member and their rank stay. */
export async function DELETE(_request: Request, { params }: Params) {
  const denied = await officer();
  if (denied) return denied;
  const { characterId } = await params;
  try {
    const removed = await db.character.delete({ where: { id: characterId }, select: { id: true, name: true, userId: true, rank: true, isMain: true } });
    return NextResponse.json({ id: removed.id, name: removed.name }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'No such character.' }, { status: 404, headers: NO_STORE });
    }
    throw e;
  }
}
