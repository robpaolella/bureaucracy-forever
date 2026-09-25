import 'server-only';

/**
 * Discord guild lookups done server-side with the bot token, so a sign-in only needs the
 * `identify` scope and roles can be re-read later without the user's token.
 */

export type GuildMember = {
  /** Role ids. The ONLY field access decisions read (lib/auth/roles.ts). */
  roles: string[];
  nick: string | null;
};

/**
 * `member`: in the guild, roles known. `absent`: Discord says they are not in the guild
 * (404), which is a definite answer. `error`: nothing is known (rate limit, outage, bad
 * token, network); callers must not treat this as "no roles".
 */
export type GuildLookup = { kind: 'member'; member: GuildMember } | { kind: 'absent' } | { kind: 'error'; status?: number };

const API = 'https://discord.com/api/v10';

type Env = Record<string, string | undefined>;

/** Look up `discordId` in the configured guild. Only `roles` and `nick` are retained. */
export async function lookupGuildMember(discordId: string, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<GuildLookup> {
  const token = env.DISCORD_BOT_TOKEN;
  const guild = env.DISCORD_GUILD_ID;
  if (!token || !guild) throw new Error('DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must both be set');
  if (!/^\d{5,25}$/.test(discordId)) return { kind: 'absent' };

  let res: Response;
  try {
    res = await fetchImpl(`${API}/guilds/${guild}/members/${discordId}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
  } catch {
    return { kind: 'error' };
  }
  if (res.status === 404) return { kind: 'absent' };
  if (!res.ok) return { kind: 'error', status: res.status };

  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== 'object') return { kind: 'error', status: res.status };
  const raw = body as { roles?: unknown; nick?: unknown };
  const roles = Array.isArray(raw.roles) ? raw.roles.filter((r): r is string => typeof r === 'string') : [];
  return { kind: 'member', member: { roles, nick: typeof raw.nick === 'string' ? raw.nick : null } };
}

/** The name shown on the site: guild nickname first, then Discord display name, then username. */
export function displayName(member: GuildMember | null, profile: { global_name?: string | null; username?: string | null }): string {
  return member?.nick || profile.global_name || profile.username || 'Member';
}
