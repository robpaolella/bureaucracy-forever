import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addAlt } from '@/lib/characters';
import { Prisma } from '@/lib/generated/prisma/client';
import { setRankFromWeb } from '@/lib/roles-sync';
import { OFFICER_RANK_ERROR } from '@/content/roster-editor';
import { parseCharacterInput } from '@/lib/roster-edit';
import { getSession } from '@/lib/session';
import { toPrismaCharacter } from './fields';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/roster — give a member their main character, or an alt with `alt: true` (officers). Body
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
  if (b.alt === true) {
    const result = await addAlt(userId, b);
    return NextResponse.json('error' in result ? { error: result.error } : result.character, { status: result.status, headers: NO_STORE });
  }
  const parsed = parseCharacterInput(b);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });
  if (parsed.value.rank === 'officer') return NextResponse.json({ error: OFFICER_RANK_ERROR }, { status: 400, headers: NO_STORE });

  try {
    // Check and create in one serializable transaction so two officers cannot both give
    // the same member a main.
    const outcome = await db.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, characters: { where: { isMain: true }, select: { id: true } } } });
        if (!user) return { status: 404, error: 'No such member.' } as const;
        if (user.characters.length > 0) return { status: 409, error: 'That member already has a main. Edit it instead.' } as const;
        const created = await tx.character.create({ data: { userId: user.id, isMain: true, ...toPrismaCharacter(parsed.value) }, select: { id: true, name: true } });
        return { status: 201, created } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if ('error' in outcome) return NextResponse.json({ error: outcome.error }, { status: outcome.status, headers: NO_STORE });
    // The character's rank field mirrors the user's; the user's is what the roster and the Discord
    // roles follow. An officer keeps OFFICER whatever the form said; the main mirrors that.
    const wrote = await setRankFromWeb(userId, parsed.value.rank.toUpperCase() as Uppercase<typeof parsed.value.rank>);
    if (wrote === 'officer') await db.character.updateMany({ where: { userId, isMain: true }, data: { rank: 'OFFICER' } });
    return NextResponse.json(outcome.created, { status: 201, headers: NO_STORE });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'That character name is already on the roster.' }, { status: 409, headers: NO_STORE });
    }
    // Serialization failure: the other officer's write landed first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034') {
      return NextResponse.json({ error: 'That member already has a main. Edit it instead.' }, { status: 409, headers: NO_STORE });
    }
    throw e;
  }
}
