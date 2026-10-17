import { NextResponse } from 'next/server';
import { authorizeBot, NO_STORE } from '../../_lib';
import { readMessage } from './message';

/**
 * GET /api/bot/messages/:id — a relay message with what the bot needs to render its copy,
 * including the `ping` rule (SYNC-SPEC §13).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { id } = await params;
  const message = await readMessage(id);
  if (!message) return NextResponse.json({ error: 'No such message.' }, { status: 404, headers: NO_STORE });
  return NextResponse.json(message, { headers: NO_STORE });
}
