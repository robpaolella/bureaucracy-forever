import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { reply, withIdempotency, type Reply } from '@/lib/idempotency';
import { parseMentions } from '@/lib/mentions-input';
import { enqueue } from '@/lib/outbox';
import { parseApplicantEdit } from '@/lib/relay';
import { authorizeBot, isSnowflake, readJson } from '../../_lib';

const UNCHANGED = () => reply(200, { changed: false });

const attachmentCount = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** The stored message with this DM id, whatever its state, or null for an unknown or malformed id. */
async function findMessage(dmMessageId: string) {
  if (!isSnowflake(dmMessageId)) return null;
  return db.applicantMessage.findUnique({
    where: { dmMessageId },
    select: { id: true, applicationId: true, direction: true, body: true, attachments: true, deletedAt: true, application: { select: { status: true } } },
  });
}

/** Whether an edit or delete applies (§13): from the applicant, not deleted, on a `PENDING` application. */
const isLive = (m: NonNullable<Awaited<ReturnType<typeof findMessage>>>) =>
  m.direction === 'FROM_APPLICANT' && !m.deletedAt && m.application.status === 'PENDING';

/** Applies `data` while the message is still live (re-checked in the write), then queues its copy. */
async function change(m: { id: string; applicationId: string }, data: { body: string; mentions: Prisma.InputJsonValue | typeof Prisma.DbNull; editedAt: Date } | { deletedAt: Date }): Promise<Reply> {
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
 * PATCH /api/bot/applicant-messages/:dmMessageId — `{ body, mentions? }`, key = `<dmMessageId>:edit:<the
 * edit's Discord timestamp>` (SYNC-SPEC §13). Sets the text, `mentions` (cleared when omitted) and `editedAt` and queues
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
    const m = await findMessage(dmMessageId);
    const parsed = parseApplicantEdit(read.body, m ? attachmentCount(m.attachments) : 0);
    if (!parsed.ok) return reply(400, { reason: 'invalid', error: parsed.error });
    const mentions = parseMentions(read.body.mentions);
    if (!mentions.ok) return reply(400, { reason: 'invalid', error: mentions.error });
    if (!m || !isLive(m) || parsed.text === m.body) return UNCHANGED();
    return change(m, { body: parsed.text, mentions: mentions.mentions ?? Prisma.DbNull, editedAt: new Date() });
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
    const m = await findMessage(dmMessageId);
    return m && isLive(m) ? change(m, { deletedAt: new Date() }) : UNCHANGED();
  });
}
