import { NextResponse } from 'next/server';
import { loadRaidView } from '@/lib/raid-view';
import { authorizeBot, isSnowflake, NO_STORE } from '../../_lib';

/** GET /api/bot/raids/:id[?discordId=] — raid, template, counts and the viewer's standing (SYNC-SPEC §4). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { id } = await params;
  const viewer = new URL(request.url).searchParams.get('discordId');
  const view = await loadRaidView(id, isSnowflake(viewer) ? viewer : null);
  if (!view) return NextResponse.json({ error: 'No such raid.' }, { status: 404, headers: NO_STORE });
  return NextResponse.json(view, { headers: NO_STORE });
}
