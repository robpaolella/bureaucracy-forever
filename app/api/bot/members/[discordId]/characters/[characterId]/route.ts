import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { removeCharacter } from '@/lib/characters';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, NO_STORE } from '../../../../_lib';

export async function DELETE(request: Request, { params }: { params: Promise<{ discordId: string; characterId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { discordId, characterId } = await params;
  if (!isSnowflake(discordId)) return NextResponse.json({ reason: 'invalid', error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  return withIdempotency(request, async () => {
    const user = await db.user.findUnique({ where: { discordId }, select: { id: true } });
    if (!user) return reply(404, { error: 'Unknown member.' });
    const character = await db.character.findUnique({ where: { id: characterId }, select: { userId: true, isMain: true } });
    if (!character) return reply(204, {});
    if (character.userId !== user.id) return reply(404, { error: 'No such character.' });
    if (character.isMain) return reply(409, { reason: 'main', error: 'Your main cannot be removed here.' });
    // Recheck inside the transaction: the alt may have become main since this read.
    const result = await removeCharacter(user.id, characterId, { altOnly: true });
    if ('reason' in result && result.reason !== 'not_found') return reply(result.status, { reason: result.reason, error: result.error });
    return reply(204, {});
  });
}
