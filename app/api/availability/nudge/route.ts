import { NextResponse } from 'next/server';
import { enqueue } from '@/lib/outbox';
import { loadNotSubmitted } from '@/lib/roster-availability';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/availability/nudge — ask the bot to remind everyone who has not painted a week
 * (docs/05 § Hasn't submitted). Officers only. Queues a note for #officers through the
 * outbox; the bot posts it on its next poll (SYNC-SPEC §5).
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers only.' }, { status: 403, headers: NO_STORE });
  const members = await loadNotSubmitted();
  if (members.length === 0) return NextResponse.json({ nudged: 0 }, { headers: NO_STORE });

  // Queued for the bot (SYNC-SPEC §5 officers.notify); the reminder itself is posted by the bot.
  await enqueue('officers.notify', { text: `${members.length} member${members.length === 1 ? ' has' : 's have'} not painted availability: ${members.map((m) => m.discordName).join(', ')}`, discordIds: members.map((m) => m.discordId) });
  return NextResponse.json({ nudged: members.length }, { headers: NO_STORE });
}
