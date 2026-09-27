import { NextResponse } from 'next/server';
import { verifyBearer } from '@/lib/bot-auth';
import { db } from '@/lib/db';

export const NO_STORE = { 'Cache-Control': 'private, no-store' };
export const MAX_BODY_BYTES = 64 * 1024;

/** 401/503 response, or null when the bearer secret checks out. */
export function authorizeBot(request: Request): NextResponse | null {
  const auth = verifyBearer(request.headers.get('authorization'), process.env.BOT_SHARED_SECRET);
  return auth.ok ? null : NextResponse.json({ error: auth.error }, { status: auth.status, headers: NO_STORE });
}

/** The JSON body, or a 400/413 response. */
export async function readJson(request: Request): Promise<{ body: Record<string, unknown> } | { deny: NextResponse }> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return { deny: NextResponse.json({ error: 'Body too large.' }, { status: 413, headers: NO_STORE }) };
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { deny: NextResponse.json({ error: 'Body too large.' }, { status: 413, headers: NO_STORE }) };
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return { body: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {} };
  } catch {
    return { deny: NextResponse.json({ error: 'Body must be JSON.' }, { status: 400, headers: NO_STORE }) };
  }
}

const SNOWFLAKE = /^\d{17,20}$/;
export const isSnowflake = (v: unknown): v is string => typeof v === 'string' && SNOWFLAKE.test(v);
export const str = (v: unknown, max = 2000): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** The User row for a Discord id, with role and main, for authorisation of bot-relayed actions. */
export async function userByDiscordId(discordId: string) {
  return db.user.findUnique({
    where: { discordId },
    select: { id: true, discordName: true, role: true, rank: true, inGuild: true, characters: { where: { isMain: true }, take: 1, select: { name: true, class: true, spec: true, raidRole: true } } },
  });
}
