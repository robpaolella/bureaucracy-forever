import { NextResponse } from 'next/server';
import { getInterview } from '@/lib/interviews';
import { authorizeBot, NO_STORE } from '../../_lib';

/** GET /api/bot/interviews/:id — the interview for rendering (SYNC-SPEC §4, §12). 404 `{ error }` if unknown. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const { id } = await params;
  const interview = await getInterview(id);
  if (!interview) return NextResponse.json({ error: 'Interview not found.' }, { status: 404, headers: NO_STORE });
  return NextResponse.json(interview, { headers: NO_STORE });
}
