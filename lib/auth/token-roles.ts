import type { Role } from '@/lib/session';
import { displayName, type GuildMember } from './discord';
import { roleFromDiscordRoles, type RoleIds } from './roles';

/** The role-bearing fields auth.ts keeps on the JWT. Read defensively; the token is untyped. */
export type RoleClaims = {
  discordId: string;
  role: Role;
  name: string;
  /** Epoch ms of the last guild-role read. */
  rolesCheckedAt: number;
};

export const ROLE_TTL_MS = 60 * 60 * 1000;

const ROLES: readonly Role[] = ['social', 'member', 'officer'];

export function asRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : 'social';
}

export function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

type Fetch = (discordId: string) => Promise<GuildMember | null>;
type Profile = { global_name?: string | null; username?: string | null };

/**
 * Claims for a fresh sign-in. Roles come from the guild member record and nothing else;
 * a failed lookup (not in guild, API down) yields `social`, never a stale or higher role.
 */
export async function claimsForSignIn(discordId: string, profile: Profile, ids: RoleIds, fetchMember: Fetch, now = Date.now()): Promise<RoleClaims> {
  const member = await fetchMember(discordId);
  return {
    discordId,
    role: roleFromDiscordRoles(member?.roles ?? [], ids),
    name: displayName(member, profile),
    rolesCheckedAt: now,
  };
}

/**
 * Re-read roles once the TTL has passed; otherwise return the token unchanged. Tokens
 * without a Discord id cannot be refreshed and fall back to `social`.
 */
export async function refreshClaims(
  token: Record<string, unknown>,
  ids: RoleIds,
  fetchMember: Fetch,
  now = Date.now(),
): Promise<Pick<RoleClaims, 'role' | 'rolesCheckedAt'>> {
  const current = { role: asRole(token.role), rolesCheckedAt: asNumber(token.rolesCheckedAt) };
  if (typeof token.discordId !== 'string') return { role: 'social', rolesCheckedAt: now };
  if (now - current.rolesCheckedAt <= ROLE_TTL_MS) return current;
  const member = await fetchMember(token.discordId);
  return { role: roleFromDiscordRoles(member?.roles ?? [], ids), rolesCheckedAt: now };
}
