import { withIdempotency, reply } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, readJson } from '../../../_lib';
import { applyDiscordAnswer } from '../../_respond';

/** POST /api/bot/raids/:id/bench — `{ discordId }`: opt onto the bench (SYNC-SPEC §4). 409 if already on the roster. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const discordId = read.body.discordId;
    if (!isSnowflake(discordId)) return reply(400, { error: 'discordId must be a Discord id.' });
    return applyDiscordAnswer(id, discordId, { kind: 'bench' });
  });
}
