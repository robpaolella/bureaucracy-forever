import { withIdempotency, reply } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, readJson, str } from '../../../_lib';
import { applyDiscordAnswer, parseResponse } from '../../_respond';

/** POST /api/bot/raids/:id/respond — `{ discordId, response: ACCEPT|TENTATIVE|ABSENT, reason? }` (SYNC-SPEC §4, rules §7). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const discordId = read.body.discordId;
    if (!isSnowflake(discordId)) return reply(400, { error: 'discordId must be a Discord id.' });
    const response = parseResponse(read.body.response);
    if (!response) return reply(400, { error: 'response must be ACCEPT, TENTATIVE or ABSENT.' });
    const characterId = read.body.characterId;
    if (characterId !== undefined && (typeof characterId !== 'string' || !characterId.trim() || response === 'absent')) {
      return reply(400, { error: 'characterId must be a non-empty character id and cannot accompany ABSENT.' });
    }
    return applyDiscordAnswer(id, discordId, { kind: 'respond', response, reason: str(read.body.reason, 200), characterId });
  });
}
