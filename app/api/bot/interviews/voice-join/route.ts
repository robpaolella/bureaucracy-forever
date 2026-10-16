import { NextResponse } from 'next/server';
import { notifyVoiceJoin } from '@/lib/tick';
import { authorizeBot, isSnowflake, NO_STORE, readJson } from '../../_lib';

/**
 * POST /api/bot/interviews/voice-join — a member joined Public Lounge (SYNC-SPEC §4).
 * `channelId` is the bot's business, not checked here. Idempotent by `joinedNotifiedAt`.
 */
export async function POST(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { discordId } = read.body;
  if (!isSnowflake(discordId)) return NextResponse.json({ error: 'discordId is required.' }, { status: 400, headers: NO_STORE });
  return NextResponse.json(await notifyVoiceJoin(discordId), { headers: NO_STORE });
}
