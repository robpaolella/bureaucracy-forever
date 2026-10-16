import { withIdempotency } from '@/lib/idempotency';
import { cancelInterview } from '@/lib/interviews';
import { authorizeBot, interviewOfficer, interviewReply, readJson } from '../../../_lib';

/** POST /api/bot/interviews/:id/cancel — `{ byDiscordId }` (SYNC-SPEC §4, §12). 200 `{ interview }`; 409 `not_active` once ended. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const who = await interviewOfficer(read.body);
    if ('deny' in who) return who.deny;
    return interviewReply(await cancelInterview(id, who.officer), 200);
  });
}
