import { decideApplication } from '@/lib/decisions';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, readJson, str, userByDiscordId } from '../../../_lib';

/** POST /api/bot/applications/:id/decision — `{ status: ACCEPTED|DECLINED, byDiscordId, reason? }` (SYNC-SPEC §4). 409 if not pending. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const status = String(read.body.status ?? '').toLowerCase();
    if (status !== 'accepted' && status !== 'declined') return reply(400, { error: 'status must be ACCEPTED or DECLINED.' });
    const by = read.body.byDiscordId;
    if (!isSnowflake(by)) return reply(400, { error: 'byDiscordId must be a Discord id.' });
    const officer = await userByDiscordId(by);
    if (!officer || officer.role !== 'OFFICER') return reply(403, { error: 'Only officers decide applications.' });
    const outcome = await decideApplication(id, status, { userId: officer.id, name: officer.characters[0]?.name ?? officer.discordName, source: 'discord' }, str(read.body.reason, 500));
    if (outcome === 'missing') return reply(404, { error: 'No such application.' });
    if (outcome === 'conflict') return reply(409, { reason: 'This application was already decided.' });
    return reply(200, { id, status });
  });
}
