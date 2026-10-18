import { db } from '@/lib/db';
import { Prisma } from '@/lib/generated/prisma/client';
import { reply, withIdempotency, type Complete, type Reply } from '@/lib/idempotency';
import { enqueue } from '@/lib/outbox';
import { inRelayWindow, parseApplicantDm, type ApplicantDm } from '@/lib/relay';
import { authorizeBot, readJson } from '../_lib';

const isDuplicate = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** A stored applicant DM's reply, or null when the DM id is not one (SYNC-SPEC §13). */
async function storedReply(dmMessageId: string): Promise<Reply | null> {
  const existing = await db.applicantMessage.findUnique({ where: { dmMessageId }, select: { id: true, applicationId: true, direction: true } });
  if (!existing) return null;
  if (existing.direction !== 'FROM_APPLICANT') return reply(200, { stored: false });
  return reply(200, { stored: true, applicationId: existing.applicationId, messageId: existing.id });
}

async function store(dm: ApplicantDm, complete: Complete): Promise<Reply> {
  const repeat = await storedReply(dm.dmMessageId);
  if (repeat) return repeat;
  // §13: only the sender's most recent application, and only if it was PENDING at the send time.
  const app = await db.application.findFirst({
    where: { discordId: dm.discordId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true, reopenedAt: true, decidedAt: true },
  });
  if (!app || !inRelayWindow(app, dm.createdAt)) return reply(200, { stored: false });
  try {
    // The key's stored reply commits with the message and its job.
    return await db.$transaction(async (tx) => {
      const row = await tx.applicantMessage.create({
        data: { applicationId: app.id, direction: 'FROM_APPLICANT', body: dm.body, createdAt: dm.createdAt, dmChannelId: dm.dmChannelId, dmMessageId: dm.dmMessageId, attachments: dm.attachments },
        select: { id: true },
      });
      await enqueue('application.message.copy', { applicationId: app.id, messageId: row.id }, tx);
      return complete(tx, reply(200, { stored: true, applicationId: app.id, messageId: row.id }));
    });
  } catch (e) {
    // The same DM arriving under another key at the same moment: the first one stored it.
    if (isDuplicate(e)) {
      const raced = await storedReply(dm.dmMessageId);
      if (raced) return raced;
    }
    throw e;
  }
}

/**
 * POST /api/bot/applicant-messages — an applicant's DM to the bot (SYNC-SPEC §13). `{ discordId,
 * dmChannelId, dmMessageId, body, createdAt, attachments }`, key = the DM message id. Stored
 * on the sender's most recent application when it was PENDING at the DM's send time, then
 * `application.message.copy` is queued: `{ stored: true, applicationId, messageId }`.
 * Otherwise `{ stored: false }`. A repeat DM id returns the same reply and queues nothing.
 */
export async function POST(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  return withIdempotency(request, async (complete) => {
    const parsed = parseApplicantDm(read.body);
    if (!parsed.ok) return reply(400, { reason: 'invalid', error: parsed.error });
    return store(parsed.dm, complete);
  });
}
