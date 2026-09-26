import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { parseCharacterInput } from '@/lib/roster-edit';
import { getSession } from '@/lib/session';
import { toPrismaCharacter } from './fields';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/roster — give a member their main character (officers). Body
 * `{ userId, name, wowClass, spec, role, rank }`. A member has one main; a second
 * request for the same member is 409, as is a name already on the roster.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit the roster.' }, { status: 403, headers: NO_STORE });

  const body: unknown = await request.json().catch(() => null);
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const userId = typeof b.userId === 'string' && b.userId ? b.userId : null;
  if (!userId) return NextResponse.json({ error: 'Pick a member.' }, { status: 400, headers: NO_STORE });
  const parsed = parseCharacterInput(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, characters: { where: { isMain: true }, select: { id: true } } } });
  if (!user) return NextResponse.json({ error: 'No such member.' }, { status: 404, headers: NO_STORE });
  if (user.role === 'SOCIAL') return NextResponse.json({ error: 'Social members are not on the raid roster.' }, { status: 409, headers: NO_STORE });
  if (user.characters.length > 0) return NextResponse.json({ error: 'That member already has a main. Edit it instead.' }, { status: 409, headers: NO_STORE });

  try {
    const created = await db.character.create({ data: { userId: user.id, isMain: true, ...toPrismaCharacter(parsed.value) }, select: { id: true, name: true } });
    return NextResponse.json(created, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'That character name is already on the roster.' }, { status: 409, headers: NO_STORE });
    }
    throw e;
  }
}
