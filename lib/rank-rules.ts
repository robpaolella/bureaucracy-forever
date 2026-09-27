/**
 * Roster rank ⇄ Discord roles (docs/04 § Roster, SYNC-SPEC §3 "Roster derivation").
 * Discord is the source for who is in the guild and, through the Officer, Trial and Raider
 * roles, for rank; the web roster editor writes rank too, and the Discord roles follow it.
 * Whichever wrote last wins. Pure, so both directions are unit-tested.
 */
import type { Rank } from '@/lib/generated/prisma/enums';

export type RankRoleIds = {
  officer: string;
  member: string;
  raider?: string;
  trial?: string;
  social?: string;
  guest?: string;
};

/** Every role id the site knows; the optional ones are simply absent when unset. */
export function rankRoleIdsFromEnv(env: Record<string, string | undefined> = process.env): RankRoleIds {
  const officer = env.DISCORD_ROLE_OFFICER;
  const member = env.DISCORD_ROLE_MEMBER;
  if (!officer || !member) throw new Error('DISCORD_ROLE_OFFICER and DISCORD_ROLE_MEMBER must both be set');
  return { officer, member, raider: env.DISCORD_ROLE_RAIDER || undefined, trial: env.DISCORD_ROLE_TRIAL || undefined, social: env.DISCORD_ROLE_SOCIAL || undefined, guest: env.DISCORD_ROLE_GUEST || undefined };
}

/** Officer beats Trial beats Raider; anyone else is Social. Only the `roles` array is consulted. */
export function rankFromDiscordRoles(roles: readonly string[], ids: RankRoleIds): Rank {
  if (roles.includes(ids.officer)) return 'OFFICER';
  if (ids.trial && roles.includes(ids.trial)) return 'TRIAL';
  if (ids.raider && roles.includes(ids.raider)) return 'RAIDER';
  return 'SOCIAL';
}

/** On the roster at all: Guild Member or Officer. */
export function inGuildFromDiscordRoles(roles: readonly string[], ids: RankRoleIds): boolean {
  return roles.includes(ids.member) || roles.includes(ids.officer);
}

export type RoleChanges = { add: string[]; remove: string[] };

/**
 * The Discord roles a rank implies. Raiders and officers hold Raider; trials hold Raider
 * and Trial; socials hold Social. Officer itself is never touched (it grants site access).
 * Ids that are not configured are left out, so a partial setup changes only what it knows.
 */
export function roleChangesForRank(rank: Rank, ids: RankRoleIds): RoleChanges {
  const want = { raider: rank !== 'SOCIAL', trial: rank === 'TRIAL', social: rank === 'SOCIAL' };
  const add: string[] = [];
  const remove: string[] = [];
  for (const key of ['raider', 'trial', 'social'] as const) {
    const id = ids[key];
    if (!id) continue;
    (want[key] ? add : remove).push(id);
  }
  return { add, remove };
}

/** Accepting an application: Guild Member in, Guest out, plus the roles of the rank the path implies. */
export function roleChangesForAccept(path: 'raider' | 'social', ids: RankRoleIds): RoleChanges {
  const rank = roleChangesForRank(path === 'raider' ? 'TRIAL' : 'SOCIAL', ids);
  return { add: [ids.member, ...rank.add], remove: [...(ids.guest ? [ids.guest] : []), ...rank.remove] };
}

/** How long a trial runs before officers are asked to extend or end it. */
export const TRIAL_DAYS = 14;

/** A trial that started TRIAL_DAYS ago and has not been raised in #officer-chat yet. */
export function trialCheckInDue(user: { rank: Rank; trialStartedAt: Date | null; trialNudgedAt: Date | null }, now: Date): boolean {
  if (user.rank !== 'TRIAL' || !user.trialStartedAt || user.trialNudgedAt) return false;
  return now.getTime() - user.trialStartedAt.getTime() >= TRIAL_DAYS * 24 * 3_600_000;
}

/** The snapshot's names, so a member's row reads the way Discord shows them. */
export type SnapshotMember = { discordId: string; name: string; avatarUrl: string | null; roles: string[] };

export function parseSnapshotMember(v: unknown): SnapshotMember | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  if (typeof m.discordId !== 'string' || !/^\d{17,20}$/.test(m.discordId)) return null;
  const name = typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 80) : null;
  if (!name) return null;
  const roles = Array.isArray(m.roles) ? m.roles.filter((r): r is string => typeof r === 'string') : [];
  const avatarUrl = typeof m.avatarUrl === 'string' && /^https:\/\//.test(m.avatarUrl) ? m.avatarUrl.slice(0, 300) : null;
  return { discordId: m.discordId, name, avatarUrl, roles };
}
