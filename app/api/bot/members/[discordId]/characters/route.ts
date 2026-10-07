import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { addAlt } from '@/lib/characters';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, botCharacter, isSnowflake, NO_STORE, readJson } from '../../../_lib';

export async function POST(request: Request, { params }: { params: Promise<{ discordId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) {
    if (read.deny.status !== 400) return read.deny;
    return NextResponse.json({ ...await read.deny.json(), reason: 'invalid' }, { status: 400, headers: NO_STORE });
  }
  const { discordId } = await params;
  if (!isSnowflake(discordId)) return NextResponse.json({ reason: 'invalid', error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  return withIdempotency(request, async () => {
    const user = await db.user.findUnique({ where: { discordId }, select: { id: true } });
    if (!user) return reply(404, { error: 'Unknown member.' });
    const result = await addAlt(user.id, { ...read.body, role: read.body.raidRole });
    if ('reason' in result) return reply(result.status, { reason: result.reason, error: result.error });
    return reply(result.status, { character: botCharacter(result.character) });
  });
}
