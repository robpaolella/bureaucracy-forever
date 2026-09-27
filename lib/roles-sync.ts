import 'server-only';

import { db } from '@/lib/db';
import { enqueue } from '@/lib/outbox';
import { isRosterRank } from '@/lib/series';

/**
 * SYNC-SPEC §3 and §9.6: the Discord Raider role follows the web roster rank, never the
 * other way round. Queues member.roles.sync when a rank change crosses the roster line.
 * Only ever touches the Raider role; Guild Member, Guest and Officer are the bot's or humans'.
 */
export async function syncRaiderRole(userId: string, previousRank: string | null, nextRank: string | null): Promise<void> {
  const roleId = process.env.DISCORD_ROLE_RAIDER;
  if (!roleId) return;
  const was = previousRank !== null && isRosterRank(previousRank);
  const now = nextRank !== null && isRosterRank(nextRank);
  if (was === now) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { discordId: true } });
  if (!user) return;
  await enqueue('member.roles.sync', { discordId: user.discordId, add: now ? [roleId] : [], remove: now ? [] : [roleId] });
}
