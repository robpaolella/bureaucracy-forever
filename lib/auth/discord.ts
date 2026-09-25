/**
 * Discord guild lookups done server-side with the bot token, so a sign-in only needs the
 * `identify` scope and roles can be re-read later without the user's token.
 */

export type GuildMember = {
  /** Role ids. The ONLY field access decisions read (lib/auth/roles.ts). */
  roles: string[];
  nick: string | null;
  avatar: string | null;
};

const API = 'https://discord.com/api/v10';

type Env = Record<string, string | undefined>;

/**
 * The member record for `discordId` in the configured guild, or `null` when they are not
 * in the guild (404) or the lookup fails. Failure means no access is granted, never more.
 * `permissions` and every other field are deliberately dropped here.
 */
export async function fetchGuildMember(discordId: string, env: Env = process.env, fetchImpl: typeof fetch = fetch): Promise<GuildMember | null> {
  const token = env.DISCORD_BOT_TOKEN;
  const guild = env.DISCORD_GUILD_ID;
  if (!token || !guild) throw new Error('DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must both be set');
  if (!/^\d{5,25}$/.test(discordId)) return null;

  let res: Response;
  try {
    res = await fetchImpl(`${API}/guilds/${guild}/members/${discordId}`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== 'object') return null;
  const raw = body as { roles?: unknown; nick?: unknown; avatar?: unknown };
  const roles = Array.isArray(raw.roles) ? raw.roles.filter((r): r is string => typeof r === 'string') : [];
  return {
    roles,
    nick: typeof raw.nick === 'string' ? raw.nick : null,
    avatar: typeof raw.avatar === 'string' ? raw.avatar : null,
  };
}

/** The name shown on the site: guild nickname first, then Discord display name, then username. */
export function displayName(member: GuildMember | null, profile: { global_name?: string | null; username?: string | null }): string {
  return member?.nick || profile.global_name || profile.username || 'Member';
}
