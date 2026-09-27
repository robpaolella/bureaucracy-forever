import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { NOTE_MAX } from '@/lib/applications-decide';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, NO_STORE, readJson, str } from '../../../_lib';

type Params = { params: Promise<{ discordMessageId: string }> };

/** PATCH /api/bot/notes/by-message/:discordMessageId — `{ body }` after an officer edits their thread message (SYNC-SPEC §4). */
export async function PATCH(request: Request, { params }: Params) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { discordMessageId } = await params;
  if (!isSnowflake(discordMessageId)) return NextResponse.json({ error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  return withIdempotency(request, async () => {
    const body = str(read.body.body, NOTE_MAX);
    if (!body) return reply(400, { error: 'body is empty.' });
    const updated = await db.officerNote.updateMany({ where: { discordMessageId, deletedAt: null }, data: { body, editedAt: new Date() } });
    if (updated.count === 0) return reply(404, { error: 'No note for that message.' });
    return reply(200, { discordMessageId, edited: true });
  });
}

/** DELETE /api/bot/notes/by-message/:discordMessageId — soft delete; hidden on the web (SYNC-SPEC §3). */
export async function DELETE(request: Request, { params }: Params) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { discordMessageId } = await params;
  if (!isSnowflake(discordMessageId)) return NextResponse.json({ error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  return withIdempotency(request, async () => {
    const updated = await db.officerNote.updateMany({ where: { discordMessageId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (updated.count === 0) return reply(404, { error: 'No note for that message.' });
    return reply(200, { discordMessageId, deleted: true });
  });
}
