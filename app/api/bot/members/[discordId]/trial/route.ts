import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reply, withIdempotency } from '@/lib/idempotency';
import { extendedCheckInAt, parseTrialAction } from '@/lib/rank-rules';
import { setRankFromWeb } from '@/lib/roles-sync';
import { authorizeBot, isSnowflake, NO_STORE, readJson, userByDiscordId } from '../../../_lib';

const notTrial = (name: string, rank: string) => reply(409, { reason: `${name} is not a trial any more (rank: ${rank.toLowerCase()}).` });

/**
 * POST /api/bot/members/:discordId/trial — an officer's answer to the trial check-in in
 * #officers (SYNC-SPEC §3, §4). `{ action: 'promote' | 'extend', days?, byDiscordId }`.
 * Promote sets rank RAIDER the way the roster editor does, so the Trial role comes off
 * through member.roles.sync. Extend moves the next check-in `days` (1–7) from now and
 * clears the nudge so tick posts it again then. 403 unless `byDiscordId` is an officer;
 * 404 for an unknown member; 409 with a reason when they are no longer a trial.
 */
export async function POST(request: Request, { params }: { params: Promise<{ discordId: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { discordId } = await params;
  if (!isSnowflake(discordId)) return NextResponse.json({ error: 'Not a Discord id.' }, { status: 400, headers: NO_STORE });
  return withIdempotency(request, async () => {
    const byDiscordId = read.body.byDiscordId;
    if (!isSnowflake(byDiscordId)) return reply(400, { error: 'byDiscordId must be a Discord id.' });
    const parsed = parseTrialAction(read.body);
    if (!parsed.ok) return reply(400, { error: parsed.error });

    const by = await userByDiscordId(byDiscordId);
    if (!by || by.role !== 'OFFICER') return reply(403, { error: 'Only officers answer trial check-ins.' });
    const user = await db.user.findUnique({ where: { discordId }, select: { id: true, discordName: true, rank: true } });
    if (!user) return reply(404, { error: 'Unknown member.' });
    if (user.rank !== 'TRIAL') return notTrial(user.discordName, user.rank);

    if (parsed.value.action === 'promote') {
      const wrote = await setRankFromWeb(user.id, 'RAIDER');
      if (wrote === 'missing') return reply(404, { error: 'Unknown member.' });
      if (wrote !== 'changed') {
        // The rank moved between the read above and the write (a snapshot, the roster editor).
        const current = await db.user.findUnique({ where: { id: user.id }, select: { rank: true } });
        return notTrial(user.discordName, current?.rank ?? 'unknown');
      }
      return reply(200, { action: 'promote', rank: 'raider' });
    }

    const checkInAt = extendedCheckInAt(new Date(), parsed.value.days);
    // Conditional on still being a trial, so a rank change that landed meanwhile is not undone.
    const done = await db.user.updateMany({ where: { id: user.id, rank: 'TRIAL' }, data: { trialCheckInAt: checkInAt, trialNudgedAt: null } });
    if (done.count === 0) {
      const current = await db.user.findUnique({ where: { id: user.id }, select: { rank: true } });
      return notTrial(user.discordName, current?.rank ?? 'unknown');
    }
    return reply(200, { action: 'extend', rank: 'trial', checkInAt: checkInAt.toISOString() });
  });
}
