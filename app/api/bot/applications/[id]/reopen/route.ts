import { reopenApplication } from '@/lib/decisions';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, readJson, userByDiscordId } from '../../../_lib';

/** POST /api/bot/applications/:id/reopen — `{ byDiscordId }` (SYNC-SPEC §4). 409 if pending. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const by = read.body.byDiscordId;
    if (!isSnowflake(by)) return reply(400, { error: 'byDiscordId must be a Discord id.' });
    const officer = await userByDiscordId(by);
    if (!officer || officer.role !== 'OFFICER') return reply(403, { error: 'Only officers reopen applications.' });
    const outcome = await reopenApplication(id, { userId: officer.id, name: officer.characters[0]?.name ?? officer.discordName, source: 'discord' });
    if (outcome === 'missing') return reply(404, { error: 'No such application.' });
    if (outcome === 'conflict') return reply(409, { reason: 'This application is already pending.' });
    return reply(200, { id, status: 'pending' });
  });
}
