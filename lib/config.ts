/** Site-wide constants. One place, so a page never carries its own copy. */

/** The realm's timezone. docs/01 § Time: a single config constant, never per page. */
export const REALM_TIMEZONE = 'America/Chicago';

/** Public Discord invite. Placeholder until the guild supplies the real link. */
export const DISCORD_INVITE_URL = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? 'https://discord.gg/bureaucracy';

/** Auth.js sign-in entry point (Discord provider). Wired in a later step. */
export const LOGIN_URL = '/api/auth/signin';
export const LOGOUT_URL = '/api/auth/signout';

export const SITE_NAME = 'Bureaucracy';
/** Ships on every page (docs/02 § Footer). */
export const DISCLAIMER = 'Bureaucracy · WoW Forever · Not affiliated with Blizzard Entertainment.';
