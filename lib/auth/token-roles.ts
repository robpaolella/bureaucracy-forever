import type { Role } from '@/lib/session';
import { displayName, type GuildLookup } from './discord';
import { isTemplateAdmin, roleFromDiscordRoles, type RoleIds } from './roles';

/** The role-bearing fields auth.ts keeps on the JWT. Read defensively; the token is untyped. */
export type RoleClaims = {
  discordId: string;
  role: Role;
  /** Holds the Guild Master or Administrator role: may delete raid templates (lib/auth/roles.ts). */
  templateAdmin: boolean;
  name: string;
  /** Epoch ms of the last successful guild-role read. */
  rolesCheckedAt: number;
  /** Epoch ms before which no re-read is attempted (set after a failed read). */
  rolesRetryAt: number;
};

/** Re-read roles this often. */
export const ROLE_TTL_MS = 60 * 60 * 1000;
/** After a failed read, wait this long before trying again, so an outage is not hammered. */
export const ROLE_RETRY_MS = 5 * 60 * 1000;
/** Keep an established role through Discord failures for at most this long past its last read. */
export const ROLE_GRACE_MS = 24 * 60 * 60 * 1000;

const ROLES: readonly Role[] = ['social', 'member', 'officer'];

export function asRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : 'social';
}

export function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** The access-level ids plus the template-admin ids; auth.ts joins the two env readers. */
export type ClaimIds = RoleIds & { templateAdmins: readonly string[] };

type Lookup = (discordId: string) => Promise<GuildLookup>;
type Profile = { global_name?: string | null; username?: string | null };

/**
 * Claims for a fresh sign-in. Roles come from the guild member record and nothing else.
 * There is no established role to fall back on, so an absent member or a failed lookup
 * both sign in as `social`.
 */
export async function claimsForSignIn(discordId: string, profile: Profile, ids: ClaimIds, lookup: Lookup, now = Date.now()): Promise<RoleClaims> {
  const result = await lookup(discordId);
  const member = result.kind === 'member' ? result.member : null;
  return {
    discordId,
    role: roleFromDiscordRoles(member?.roles ?? [], ids),
    templateAdmin: isTemplateAdmin(member?.roles ?? [], ids.templateAdmins),
    name: displayName(member, profile),
    rolesCheckedAt: now,
    rolesRetryAt: 0,
  };
}

type Refreshed = Pick<RoleClaims, 'role' | 'templateAdmin' | 'rolesCheckedAt' | 'rolesRetryAt'>;

/**
 * Re-read roles once the TTL has passed; otherwise return the token unchanged.
 *
 *   member  → the role Discord reports now
 *   absent  → social (a definite answer: they left the guild)
 *   error   → keep the established role while it is within the grace window, back off
 *             before retrying; past the grace window, social
 *
 * Tokens without a Discord id cannot be refreshed and are social. Tokens issued before
 * `templateAdmin` existed are re-read at once rather than waiting out the TTL.
 */
export async function refreshClaims(token: Record<string, unknown>, ids: ClaimIds, lookup: Lookup, now = Date.now()): Promise<Refreshed> {
  const current: Refreshed = {
    role: asRole(token.role),
    templateAdmin: token.templateAdmin === true,
    rolesCheckedAt: asNumber(token.rolesCheckedAt),
    rolesRetryAt: asNumber(token.rolesRetryAt),
  };
  if (typeof token.discordId !== 'string') return { role: 'social', templateAdmin: false, rolesCheckedAt: now, rolesRetryAt: 0 };
  const knowsTemplateAdmin = typeof token.templateAdmin === 'boolean';
  if (knowsTemplateAdmin && now - current.rolesCheckedAt <= ROLE_TTL_MS) return current;
  if (now < current.rolesRetryAt) return current;

  const result = await lookup(token.discordId);
  if (result.kind === 'member') return { role: roleFromDiscordRoles(result.member.roles, ids), templateAdmin: isTemplateAdmin(result.member.roles, ids.templateAdmins), rolesCheckedAt: now, rolesRetryAt: 0 };
  if (result.kind === 'absent') return { role: 'social', templateAdmin: false, rolesCheckedAt: now, rolesRetryAt: 0 };

  const withinGrace = now - current.rolesCheckedAt <= ROLE_GRACE_MS;
  return {
    role: withinGrace ? current.role : 'social',
    templateAdmin: withinGrace && current.templateAdmin,
    rolesCheckedAt: current.rolesCheckedAt,
    rolesRetryAt: now + ROLE_RETRY_MS,
  };
}
