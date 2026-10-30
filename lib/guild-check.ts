import 'server-only';

import { lookupGuildMember, type GuildLookup } from '@/lib/auth/discord';

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; result: GuildLookup }>();

/**
 * Is this Discord account in the guild? One Discord call per account per ten minutes, so
 * reloading /apply does not hammer the bot token. Only a member is cached: an absent or
 * errored lookup is asked again next time, so someone who has just joined Discord gets in at once.
 */
export async function isGuildMember(discordId: string, now = Date.now()): Promise<GuildLookup> {
  const hit = cache.get(discordId);
  if (hit && now - hit.at < TTL_MS) return hit.result;
  const result = await lookupGuildMember(discordId);
  if (result.kind === 'member') cache.set(discordId, { at: now, result });
  if (cache.size > 2000) for (const [k, v] of cache) if (now - v.at >= TTL_MS) cache.delete(k);
  return result;
}
