import { NextResponse } from 'next/server';
import { switchCharacter } from '@/lib/character-switch';
import { reply, withIdempotency } from '@/lib/idempotency';
import { REASONS as LOOT_REASONS } from '@/lib/loot-rules';
import { REASONS } from '@/lib/signup-rules';
import { authorizeBot, isSnowflake, NO_STORE, readJson, userByDiscordId } from '../../../_lib';

/** PUT /api/bot/raids/:id/character — member-only switch, governed by the sign-up lock. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) {
    if (read.deny.status !== 400) return read.deny;
    return NextResponse.json({ ...await read.deny.json(), reason: 'invalid' }, { status: 400, headers: NO_STORE });
  }
  const { id } = await params;
  return withIdempotency(request, async () => {
    const { discordId, characterId } = read.body;
    if (!isSnowflake(discordId)) return reply(400, { reason: 'invalid', error: 'discordId must be a Discord id.' });
    if (typeof characterId !== 'string' || !characterId.trim()) {
      return reply(400, { reason: 'invalid', error: 'characterId must be a non-empty character id.' });
    }
    const user = await userByDiscordId(discordId);
    if (!user) return reply(404, { error: 'Unknown member.' });
    // Even an officer acts only as themselves here; there is no override on the bot route.
    const result = await switchCharacter({ raidId: id, userId: user.id, characterId,
      actor: { role: user.role === 'SOCIAL' ? 'social' : 'member' } });
    if (!result.ok) {
      if (result.status === 404) return reply(404, { error: result.reason });
      if (result.reason === LOOT_REASONS.notYourCharacter) return reply(400, { reason: 'invalid', error: result.reason });
      const reasons: Record<string, string> = {
        [LOOT_REASONS.notEligible]: 'no_signup', [REASONS.cancelled]: 'cancelled',
        [REASONS.done]: 'done', [REASONS.locked]: 'locked', [REASONS.social]: 'forbidden',
      };
      return reply(result.status, { reason: reasons[result.reason] ?? 'forbidden', error: result.reason });
    }
    const { id: characterIdResult, name, class: wowClass, spec, raidRole } = result.character;
    return reply(200, { character: { id: characterIdResult, name, wowClass: wowClass.toLowerCase(), spec, raidRole: raidRole.toLowerCase() },
      removedReserves: result.removed.map(({ kind, itemName, reason }) => ({ kind, itemName, reason })) });
  });
}
