import { db } from '@/lib/db';
import { reply, withIdempotency } from '@/lib/idempotency';
import { NOTE_MAX } from '@/lib/applications-decide';
import { authorizeBot, isSnowflake, readJson, str, userByDiscordId } from '../../../_lib';

/**
 * POST /api/bot/applications/:id/notes — a message an officer typed in the #applications
 * thread becomes a note (SYNC-SPEC §4, §8). `{ discordMessageId, authorDiscordId, body,
 * createdAt }`. A non-officer author gets 403 and the bot ignores the message. The Discord
 * message id is unique, so a redelivered message returns the existing note.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const messageId = read.body.discordMessageId;
    if (!isSnowflake(messageId)) return reply(400, { error: 'discordMessageId must be a Discord id.' });
    const authorDiscordId = read.body.authorDiscordId;
    if (!isSnowflake(authorDiscordId)) return reply(400, { error: 'authorDiscordId must be a Discord id.' });
    const body = str(read.body.body, NOTE_MAX);
    if (!body) return reply(400, { error: 'body is empty.' });
    const createdAtRaw = typeof read.body.createdAt === 'string' ? new Date(read.body.createdAt) : new Date();
    const createdAt = Number.isNaN(createdAtRaw.getTime()) ? new Date() : createdAtRaw;

    const author = await userByDiscordId(authorDiscordId);
    if (!author || author.role !== 'OFFICER') return reply(403, { error: 'Only officers write notes.' });
    const app = await db.application.findUnique({ where: { id }, select: { id: true } });
    if (!app) return reply(404, { error: 'No such application.' });

    const existing = await db.officerNote.findUnique({ where: { discordMessageId: messageId }, select: { id: true } });
    if (existing) return reply(200, { id: existing.id, replayed: true });
    const note = await db.officerNote.create({ data: { applicationId: app.id, authorId: author.id, body, createdAt, source: 'DISCORD', discordMessageId: messageId }, select: { id: true } });
    return reply(201, { id: note.id });
  });
}
