import { db } from '@/lib/db';
import { reply, withIdempotency } from '@/lib/idempotency';
import { enqueue } from '@/lib/outbox';
import { NOT_PENDING_ERROR, parseOfficerMessage } from '@/lib/relay';
import { authorizeBot, interviewOfficer, readJson } from '../../../_lib';
import { readMessage } from '../../../messages/[id]/message';

/**
 * POST /api/bot/applications/:id/messages — an officer's message to the applicant, from the
 * bot's `/message` popup (SYNC-SPEC §13). `{ byDiscordId, body }`, key = the popup's interaction
 * id. Stores a `QUEUED` message and queues `application.message.send` together: 201
 * `{ message }`. 403 `forbidden` unless an officer, 404 for an unknown application, 409
 * `not_pending` once decided, 400 `invalid` unless 1–1,500 characters after trimming.
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
    const app = await db.application.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!app) return reply(404, { error: 'No such application.' });
    if (app.status !== 'PENDING') return reply(409, { reason: 'not_pending', error: NOT_PENDING_ERROR });
    const parsed = parseOfficerMessage(read.body.body);
    if (!parsed.ok) return reply(400, { reason: 'invalid', error: parsed.error });
    // The reply is read inside the transaction: if reading it fails, the message and its job
    // roll back with it, so the bot's retry under the same key cannot DM twice.
    const message = await db.$transaction(async (tx) => {
      const row = await tx.applicantMessage.create({
        data: { applicationId: app.id, direction: 'TO_APPLICANT', authorUserId: who.officer.userId, body: parsed.text, status: 'QUEUED' },
        select: { id: true },
      });
      await enqueue('application.message.send', { applicationId: app.id, messageId: row.id }, tx);
      return readMessage(row.id, tx);
    });
    return reply(201, { message });
  });
}
