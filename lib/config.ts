/** Site-wide constants. One place, so a page never carries its own copy. */

/**
 * The guild's timezone: the zone raid nights are announced in. WoW Forever has no realm
 * clock, so this stands where docs/01 § Time says "realm time". One constant, never per page.
 */
export const GUILD_TIMEZONE = 'America/Los_Angeles';

/** Public Discord invite. Placeholder until the guild supplies the real link. */
export const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? 'https://discord.gg/bureaucracy';

/** Sends the visitor straight to Discord; app/login/route.ts. Logging out is a server action. */
export const LOGIN_URL = '/login';

export const SITE_NAME = 'Bureaucracy';
/** Ships on every page (docs/02 § Footer). */
export const DISCLAIMER = 'Bureaucracy · WoW Forever · Not affiliated with Blizzard Entertainment.';

/** Canonical origin for absolute URLs in metadata, robots and Open Graph cards. Fixed: previews and dev still point at the real site. */
export const SITE_URL = 'https://www.bureauguild.com';
export const SITE_DESCRIPTION = 'A competitive 40-player raiding guild on WoW Forever.';
