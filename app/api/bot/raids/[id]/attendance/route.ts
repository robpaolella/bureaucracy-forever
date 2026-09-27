import { db } from '@/lib/db';
import { reply, withIdempotency } from '@/lib/idempotency';
import { authorizeBot, isSnowflake, readJson, userByDiscordId } from '../../../_lib';

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isSnowflake) : []);

/** POST /api/bot/raids/:id/attendance — `{ byDiscordId, attended: [discordId], absent: [discordId] }`. Officers only, after the raid ends (SYNC-SPEC §4). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeBot(request);
  if (denied) return denied;
  const read = await readJson(request);
  if ('deny' in read) return read.deny;
  const { id } = await params;
  return withIdempotency(request, async () => {
    const by = read.body.byDiscordId;
    if (!isSnowflake(by)) return reply(400, { error: 'byDiscordId must be a Discord id.' });
    const officer = await userByDiscordId(by);
    if (!officer || officer.role !== 'OFFICER') return reply(403, { error: 'Only officers mark attendance.' });
    const raid = await db.raid.findUnique({ where: { id }, select: { id: true, startsAt: true, durationMin: true, status: true } });
    if (!raid) return reply(404, { error: 'No such raid.' });
    if (raid.status === 'CANCELLED') return reply(409, { reason: 'This raid was cancelled.' });
    if (raid.startsAt.getTime() + raid.durationMin * 60_000 > Date.now()) return reply(409, { reason: 'Attendance opens once the raid has ended.' });
    const attended = ids(read.body.attended);
    const absent = ids(read.body.absent);
    const [a, b] = await Promise.all([
      attended.length ? db.signup.updateMany({ where: { raidId: raid.id, user: { discordId: { in: attended } } }, data: { attended: true } }) : { count: 0 },
      absent.length ? db.signup.updateMany({ where: { raidId: raid.id, user: { discordId: { in: absent } } }, data: { attended: false } }) : { count: 0 },
    ]);
    return reply(200, { raidId: raid.id, attended: a.count, absent: b.count });
  });
}
