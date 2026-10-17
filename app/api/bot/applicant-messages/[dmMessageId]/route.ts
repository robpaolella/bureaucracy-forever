import { db } from '@/lib/db';
import { reply, withIdempotency, type Reply } from '@/lib/idempotency';
import { enqueue } from '@/lib/outbox';
import { parseApplicantEdit } from '@/lib/relay';
import { authorizeBot, isSnowflake, readJson } from '../../_lib';

const UNCHANGED = () => reply(200, { changed: false });

/**
 * The stored applicant DM an edit or delete applies to (§13): found by DM message id, from the
 * applicant, not deleted, on a `PENDING` application. Null otherwise.
 */
async function findLive(dmMessageId: string) {
  if (!isSnowflake(dmMessageId)) return null;
  const m = await db.applicantMessage.findUnique({
    where: { dmMessageId },
    select: { id: true, applicationId: true, direction: true, body: true, attachments: true, deletedAt: true, application: { select: { status: true } } },
  });
  return m && m.direction === 'FROM_APPLICANT' && !m.deletedAt && m.application.status === 'PENDING' ? m : null;
}

/** Applies `data` while the message is still live (re-checked in the write), then queues its copy. */
async function change(m: { id: string; applicationId: string }, data: { body: string; editedAt: Date } | { deletedAt: Date }): Promise<Reply> {
  const changed = await db.$transaction(async (tx) => {
    const { count } = await tx.applicantMessage.updateMany({
      where: { id: m.id, deletedAt: null, application: { status: 'PENDING' } },
      data,
    });
    if (count === 0) return false;
    await enqueue('application.message.copy', { applicationId: m.applicationId, messageId: m.id }, tx);
    return true;
  });
  return changed ? reply(200, { changed: true, applicationId: m.applicationId, messageId: m.id }) : UNCHANGED();
}

/**
 * PATCH /api/bot/applicant-messages/:dmMessageId — `{ body }`, key = `<dmMessageId>:edit:<the
 * edit's Discord timestamp>` (SYNC-SPEC §13). Sets the text and `editedAt` and queues
 * `application.message.copy`: `{ changed: true, applicationId, messageId }`. Otherwise
 * `{ changed: false }`: unknown id, decided application, deleted message or an unchanged text.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ dmMessageId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { dmMessageId } = await params;
  return withIdempotency(request, async () => {
    const m = await findLive(dmMessageId);
    // With no live message there is nothing to compare, so only the body's shape is checked.
    const attachments = m ? (Array.isArray(m.attachments) ? m.attachments.length : 0) : 1;
    const parsed = parseApplicantEdit(read.body, attachments);
    if (!parsed.ok) return reply(400, { reason: 'invalid', error: parsed.error });
    if (!m || parsed.text === m.body) return UNCHANGED();
    return change(m, { body: parsed.text, editedAt: new Date() });
  });
}

/**
 * DELETE /api/bot/applicant-messages/:dmMessageId — key = `<dmMessageId>:delete` (§13). Marks
 * the message deleted, keeping its text, and queues `application.message.copy`. Same replies
 * as PATCH.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ dmMessageId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { dmMessageId } = await params;
  return withIdempotency(request, async () => {
    const m = await findLive(dmMessageId);
    return m ? change(m, { deletedAt: new Date() }) : UNCHANGED();
  });
}
