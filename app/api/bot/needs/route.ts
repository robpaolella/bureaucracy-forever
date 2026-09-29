import { NextResponse } from 'next/server';
import { needsForBot, parseNeedInput } from '@/lib/class-needs';
import { readNeedRowsUncached, setClassNeed } from '@/lib/class-needs-data';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, NO_STORE, readJson, userByDiscordId } from '../_lib';

/**
 * GET /api/bot/needs — every class and spec with its recruitment status, for the bot's
 * /recruitment menus (SYNC-SPEC §4, §9.8). Read past the cache so an officer sees the
 * status they just set.
 */
export async function GET(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  return NextResponse.json(needsForBot(await readNeedRowsUncached()), { headers: NO_STORE });
}

/**
 * PUT /api/bot/needs — `{ wowClass, spec, status, byDiscordId }` from /recruitment. The same
 * write as the web needs editor. 403 unless `byDiscordId` is an officer; 400 for an unknown
 * class, spec or status.
 */
export async function PUT(request: Request) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  return withIdempotency(request, async () => {
    const byDiscordId = read.body.byDiscordId;
    if (!isSnowflake(byDiscordId)) return reply(400, { error: 'byDiscordId must be a Discord id.' });
    const parsed = parseNeedInput(read.body);
    if (!parsed.ok) return reply(400, { error: parsed.error });
    const by = await userByDiscordId(byDiscordId);
    if (!by || by.role !== 'OFFICER') return reply(403, { error: 'Only officers set recruitment needs.' });
    await setClassNeed(parsed.value);
    const { wowClass, spec, status } = parsed.value;
    return reply(200, { wowClass, spec, status });
  });
}
