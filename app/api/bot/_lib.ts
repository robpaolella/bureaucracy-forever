import { NextResponse } from 'next/server';
import { verifyBearer } from '@/lib/bot-auth';
import { db } from '@/lib/db';
import { reply, type Reply } from '@/lib/idempotency';
import type { InterviewResult } from '@/lib/interviews';
import { MAIN_CHARACTER } from '@/lib/signup-character';

export function botCharacter(character: { id: string; name: string; class: string; spec: string; raidRole: string; isMain: boolean }) {
  return { id: character.id, name: character.name, wowClass: character.class.toLowerCase(),
    spec: character.spec, raidRole: character.raidRole.toLowerCase(), isMain: character.isMain };
}

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
    select: { id: true, discordName: true, role: true, rank: true, inGuild: true, characters: MAIN_CHARACTER },
  });
}

/** The acting officer for an interview route (SYNC-SPEC §12): 400 for a bad id, 403 `forbidden` unless an OFFICER. */
export async function interviewOfficer(body: Record<string, unknown>): Promise<{ officer: { userId: string } } | { deny: Reply }> {
  if (!isSnowflake(body.byDiscordId)) return { deny: reply(400, { error: 'byDiscordId must be a Discord id.' }) };
  const officer = await userByDiscordId(body.byDiscordId);
  if (!officer || officer.role !== 'OFFICER') return { deny: reply(403, { reason: 'forbidden', error: 'Only officers can do this.' }) };
  return { officer: { userId: officer.id } };
}

/**
 * An interview result as a reply: on success `{ interview }` for a start (201) and the bare
 * read shape otherwise (SYNC-SPEC §4); a refusal is its `{ reason, error, … }` at its status.
 */
export function interviewReply(result: InterviewResult, okStatus: 200 | 201): Reply {
  if (result.ok) return reply(okStatus, okStatus === 201 ? { interview: result.interview } : result.interview);
  return reply(result.status, { ...(result.reason ? { reason: result.reason } : {}), error: result.error,
    ...(result.interview ? { interview: result.interview } : {}), ...(result.earlierDate !== undefined ? { earlierDate: result.earlierDate } : {}) });
}
