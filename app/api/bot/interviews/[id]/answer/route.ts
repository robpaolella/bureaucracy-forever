import { withIdempotency, reply } from '@/lib/idempotency';
import { answerProposal } from '@/lib/interviews';
import { authorizeBot, interviewReply, isSnowflake, readJson } from '../../../_lib';

/** POST /api/bot/interviews/:id/answer — `{ discordId, answer: accept|decline }` (SYNC-SPEC §4, §12). 200 read shape; 403 `forbidden` unless the applicant; 409 `wrong_status`, `too_soon`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    if (!isSnowflake(read.body.discordId)) return reply(400, { error: 'discordId must be a Discord id.' });
    return interviewReply(await answerProposal(id, read.body.discordId, read.body.answer), 200);
  });
}
