/**
 * Discord role → site access level. The one place this mapping lives (docs/03 § Roles).
 *
 *   officer  <- the Discord OFFICER role (DISCORD_ROLE_OFFICER), and nothing else
 *   member   <- the Discord GUILD MEMBER role (DISCORD_ROLE_MEMBER)
 *   social   <- everyone else
 *
 * ADMINISTRATOR IS DELIBERATELY EXCLUDED. The Discord Administrator role grants nothing
 * on this site. Someone holding Administrator but not Officer is not an officer here;
 * with Guild Member they are a `member`, otherwise `social`. Officer access is granted
 * by exactly one role id, checked explicitly against the `roles` array. Do not add
 * fallbacks, do not infer officer status from Discord permission bits (ADMINISTRATOR,
 * MANAGE_GUILD), do not treat the guild owner as an officer, and ignore the `permissions`
 * field on the guild-member object entirely. There is no DISCORD_ROLE_ADMIN variable.
 *
 * Confirmed with Robert 2026-09-25. If this looks like a bug to you, it is not.
 *
 * One narrow exception, added by Robert 2026-09-28: the Guild Master role and the
 * Administrator role (by role id, DISCORD_ROLE_GUILD_MASTER / DISCORD_ROLE_ADMINISTRATOR,
 * never by permission bits) may delete raid templates. That is all they unlock. They do
 * not change the access level above, and the planner page stays officer-only.
 */

import type { Role } from '@/lib/session';

export type RoleIds = {
  officer: string;
  member: string;
};

/** Read the two role ids from the environment. Throws if either is missing. */
export function roleIdsFromEnv(env: Record<string, string | undefined> = process.env): RoleIds {
  const officer = env.DISCORD_ROLE_OFFICER;
  const member = env.DISCORD_ROLE_MEMBER;
  if (!officer || !member) {
    throw new Error('DISCORD_ROLE_OFFICER and DISCORD_ROLE_MEMBER must both be set');
  }
  return { officer, member };
}

/**
 * Derive the site role from the role ids on a Discord guild-member object.
 * Only `roles` is consulted. Nothing else about the member matters.
 */
export function roleFromDiscordRoles(discordRoleIds: readonly string[], ids: RoleIds): Role {
  if (discordRoleIds.includes(ids.officer)) return 'officer';
  if (discordRoleIds.includes(ids.member)) return 'member';
  return 'social';
}

/**
 * The Guild Master and Administrator role ids, whichever are set. Both are optional:
 * with neither set, nobody can delete templates, and sign-in still works.
 */
export function templateAdminIdsFromEnv(env: Record<string, string | undefined> = process.env): string[] {
  return [env.DISCORD_ROLE_GUILD_MASTER, env.DISCORD_ROLE_ADMINISTRATOR].filter((id): id is string => Boolean(id));
}

/** Whether these Discord roles may delete raid templates. Role ids only, matched exactly. */
export function isTemplateAdmin(discordRoleIds: readonly string[], templateAdminIds: readonly string[]): boolean {
  return templateAdminIds.some((id) => discordRoleIds.includes(id));
}
