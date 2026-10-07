import { NextResponse } from 'next/server';
import { changeMain } from '@/lib/characters';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };
type Params = { params: Promise<{ characterId: string }> };

/** POST /api/roster/[characterId]/main — officers choose a member's main. */
export async function POST(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers edit the roster.' }, { status: 403, headers: NO_STORE });
  const { characterId } = await params;
  const result = await changeMain(characterId);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: NO_STORE });
  return NextResponse.json({ id: result.character.id, name: result.character.name }, { headers: NO_STORE });
}
