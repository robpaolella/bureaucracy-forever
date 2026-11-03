import { withIdempotency } from '@/lib/idempotency';
import { rescheduleInterview } from '@/lib/interviews';
import { authorizeBot, interviewOfficer, interviewReply, readJson } from '../../../_lib';

/** POST /api/bot/interviews/:id/reschedule — `{ startsAt, bookedAt, byDiscordId }` (SYNC-SPEC §4, §12). 200 read shape; 409 `wrong_status`, `moved`, `same_time`, `not_a_slot`, `too_soon`. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const who = await interviewOfficer(read.body);
    if ('deny' in who) return who.deny;
    return interviewReply(await rescheduleInterview(id, who.officer, read.body.startsAt, read.body.bookedAt), 200);
  });
}
