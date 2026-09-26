import { NextResponse } from 'next/server';
import { botConfigured, notifyBot } from '@/lib/bot-notify';
import { loadNotSubmitted } from '@/lib/roster-availability';
import { getSession } from '@/lib/session';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * POST /api/availability/nudge — ask the bot to remind everyone who has not painted a week
 * (docs/05 § Hasn't submitted; docs/06 § Discord bot sync). Officers only. Waits for the
 * bot's answer so the officer learns whether the nudge went out.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Log in first.' }, { status: 401, headers: NO_STORE });
  if (session.role !== 'officer') return NextResponse.json({ error: 'Officers only.' }, { status: 403, headers: NO_STORE });
  if (!botConfigured()) return NextResponse.json({ error: 'Discord sync is not configured yet.' }, { status: 503, headers: NO_STORE });

  const members = await loadNotSubmitted();
  if (members.length === 0) return NextResponse.json({ nudged: 0 }, { headers: NO_STORE });

  const outcome = await notifyBot({ type: 'availability.nudge', members });
  if (outcome !== 'sent') return NextResponse.json({ error: 'The bot did not answer. Try again in a minute.' }, { status: 502, headers: NO_STORE });
  return NextResponse.json({ nudged: members.length }, { headers: NO_STORE });
}
