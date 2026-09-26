import { NextResponse } from 'next/server';
import { verifyBotRequest } from '@/lib/bot-auth';

export const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Read and verify a bot request. Returns the parsed JSON body, or the response to send
 * back (503 when no secret is configured, 401 on a bad or stale signature).
 */
export async function readBotRequest(request: Request): Promise<{ body: unknown } | { deny: NextResponse }> {
  const raw = await request.text();
  const auth = verifyBotRequest(request.headers, raw, process.env.BOT_SHARED_SECRET);
  if (!auth.ok) return { deny: NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE }) };
  try {
    return { body: raw ? JSON.parse(raw) : null };
  } catch {
    return { deny: NextResponse.json({ error: 'Body must be JSON.' }, { status: 400, headers: NO_STORE }) };
  }
}

/** GET endpoints carry the signature over an empty body. */
export function verifyBotGet(request: Request): NextResponse | null {
  const auth = verifyBotRequest(request.headers, '', process.env.BOT_SHARED_SECRET);
  return auth.ok ? null : NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
}
