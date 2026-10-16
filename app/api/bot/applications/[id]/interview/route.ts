import { withIdempotency } from '@/lib/idempotency';
import { startInterview } from '@/lib/interviews';
import { authorizeBot, interviewOfficer, interviewReply, readJson } from '../../../_lib';

/**
 * POST /api/bot/applications/:id/interview — `{ byDiscordId, confirmSecond? }` (SYNC-SPEC §4, §12).
 * 201 `{ interview }`; 409 `not_pending`, `already_active` (with `interview`) or `second_not_confirmed`
 * (with `earlierDate`); 403 unless an officer; 404 for an unknown application.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const who = await interviewOfficer(read.body);
    if ('deny' in who) return who.deny;
    return interviewReply(await startInterview(id, who.officer, { confirmSecond: read.body.confirmSecond === true }), 201);
  });
}
