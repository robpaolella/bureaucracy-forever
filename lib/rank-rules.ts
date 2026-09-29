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

/**
 * Officer beats Trial beats Raider; anyone else is Social. Only the `roles` array is consulted.
 * Null when the Raider or Trial id is not configured: a half-configured site must not read
 * everyone as Social and write that over the ranks it holds.
 */
export function rankFromDiscordRoles(roles: readonly string[], ids: RankRoleIds): Rank | null {
  if (!ids.raider || !ids.trial) return null;
  if (roles.includes(ids.officer)) return 'OFFICER';
  if (roles.includes(ids.trial)) return 'TRIAL';
  if (roles.includes(ids.raider)) return 'RAIDER';
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

/** How long a trial runs before officers are asked to promote or extend it. */
export const TRIAL_DAYS = 14;
const DAY_MS = 24 * 3_600_000;

/**
 * A trial whose check-in is due and not posted yet: at `trialCheckInAt` when an officer
 * extended it, otherwise TRIAL_DAYS after it started (SYNC-SPEC §3).
 */
export function trialCheckInDue(user: { rank: Rank; trialStartedAt: Date | null; trialNudgedAt: Date | null; trialCheckInAt: Date | null }, now: Date): boolean {
  if (user.rank !== 'TRIAL' || !user.trialStartedAt || user.trialNudgedAt) return false;
  const dueAt = user.trialCheckInAt?.getTime() ?? user.trialStartedAt.getTime() + TRIAL_DAYS * DAY_MS;
  return now.getTime() >= dueAt;
}

/** The longest single extension the Discord check-in offers, in days. */
export const TRIAL_EXTEND_MAX_DAYS = 7;

export type TrialAction = { action: 'promote' } | { action: 'extend'; days: number };

/**
 * An answer to the trial check-in (SYNC-SPEC §4 POST /members/:discordId/trial): promote, or
 * extend by a whole number of days from 1 to TRIAL_EXTEND_MAX_DAYS. `days` may arrive as a
 * number or a numeric string (a Discord select value); it is ignored for promote.
 */
export function parseTrialAction(body: Record<string, unknown>): { ok: true; value: TrialAction } | { ok: false; error: string } {
  if (body.action === 'promote') return { ok: true, value: { action: 'promote' } };
  if (body.action !== 'extend') return { ok: false, error: 'action must be promote or extend.' };
  const raw = body.days;
  const days = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{1,2}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > TRIAL_EXTEND_MAX_DAYS) return { ok: false, error: `days must be a whole number from 1 to ${TRIAL_EXTEND_MAX_DAYS}.` };
  return { ok: true, value: { action: 'extend', days } };
}

/** When an extended trial's check-in comes back. */
export function extendedCheckInAt(now: Date, days: number): Date {
  return new Date(now.getTime() + days * DAY_MS);
}

/** The snapshot's names, so a member's row reads the way Discord shows them. */
export type SnapshotMember = { discordId: string; name: string; avatarUrl: string | null; roles: string[] };

export function parseSnapshotMember(v: unknown): SnapshotMember | null {
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  if (typeof m.discordId !== 'string' || !/^\d{17,20}$/.test(m.discordId)) return null;
  const name = typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 80) : null;
  if (!name) return null;
  // No roles array is a malformed entry, not a member with no roles: the two must not read alike.
  if (!Array.isArray(m.roles)) return null;
  const roles = m.roles.filter((r): r is string => typeof r === 'string');
  const avatarUrl = typeof m.avatarUrl === 'string' && /^https:\/\//.test(m.avatarUrl) ? m.avatarUrl.slice(0, 300) : null;
  return { discordId: m.discordId, name, avatarUrl, roles };
}

export type SiteRole = 'SOCIAL' | 'MEMBER' | 'OFFICER';
export type MemberState = { role: SiteRole; inGuild: boolean; rank: Rank | null };

/** What a snapshot entry says about a member: site role, guild membership, and rank when the ids allow. */
export function memberState(m: SnapshotMember, ids: RankRoleIds): MemberState {
  const role: SiteRole = m.roles.includes(ids.officer) ? 'OFFICER' : m.roles.includes(ids.member) ? 'MEMBER' : 'SOCIAL';
  return { role, inGuild: inGuildFromDiscordRoles(m.roles, ids), rank: rankFromDiscordRoles(m.roles, ids) };
}

export type SyncedUser = { rank: Rank; role: SiteRole; inGuild: boolean; discordName: string; avatarUrl: string | null; trialStartedAt: Date | null };
export type MemberUpdate = { discordName?: string; avatarUrl?: string | null; role?: SiteRole; inGuild?: boolean; rank?: Rank; trialStartedAt?: Date | null; trialNudgedAt?: null; trialCheckInAt?: null };

/**
 * The fields a snapshot changes on an existing user, or null when nothing differs. `holding`
 * means a web write for this member is still travelling to Discord (an open roles or decide
 * job), so the rank is left alone. Staying a trial keeps the trial clock; leaving one clears it,
 * and any rank change drops an extended check-in date so a new trial starts fresh.
 */
export function memberUpdate(existing: SyncedUser, m: SnapshotMember, state: MemberState, holding: boolean, now: Date): MemberUpdate | null {
  const out: MemberUpdate = {};
  if (existing.discordName !== m.name) out.discordName = m.name;
  if (existing.avatarUrl !== m.avatarUrl) out.avatarUrl = m.avatarUrl;
  if (existing.role !== state.role) out.role = state.role;
  if (existing.inGuild !== state.inGuild) out.inGuild = state.inGuild;
  if (state.rank !== null && !holding && existing.rank !== state.rank) {
    out.rank = state.rank;
    out.trialStartedAt = state.rank === 'TRIAL' ? existing.trialStartedAt ?? now : null;
    if (state.rank !== 'TRIAL') out.trialNudgedAt = null;
    out.trialCheckInAt = null;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * A full snapshot marks everyone it leaves out as gone. Losing more than a quarter of the
 * guild in one go is a broken snapshot (a half-filled cache, a wrong server), not a real
 * exodus, so it is refused rather than acted on. Small guilds are exempt from the ratio.
 */
export function sweepAllowed(currentlyInGuild: number, wouldLeave: number): boolean {
  if (wouldLeave === 0) return true;
  if (currentlyInGuild < 8) return true;
  return wouldLeave / currentlyInGuild <= 0.25;
}
