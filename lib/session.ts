import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import type { Rank } from '@/components/ui/Badges';
import type { WowClass } from '@/lib/design/class-colors';
import { DEV_SESSION_COOKIE, devSessionFromCookie } from '@/lib/dev-session';

/** Access level, derived from Discord guild roles at sign-in (docs/03 § Roles). */
export type Role = 'social' | 'member' | 'officer';

export type Session = {
  discordId: string;
  role: Role;
  /** Display name: guild nickname, else Discord display name. */
  name: string;
  /** From the member's main character once the roster exists (step 5). */
  wowClass?: WowClass;
  avatarUrl?: string;
  /** Display rank on the roster, stored separately from `role`. Derived from role until then. */
  rank: Rank;
  /** Drives the "Not submitted" note in the Members menu. Read from the database. */
  availabilitySubmitted: boolean;
  /** Officers only: pending applications, shown as a count badge. Real value with step 9. */
  pendingApplications: number;
};

const RANK_FOR_ROLE: Record<Role, Rank> = { officer: 'officer', member: 'raider', social: 'social' };

export { DEV_SESSION_COOKIE, DEV_SESSION_STATES, isDevSessionState } from '@/lib/dev-session';

/**
 * Development only: the dev-session stub, or `undefined` when no cookie is set. Never
 * touches cookies in production, so layouts that call it stay static there.
 */
export async function getDevStubSession(): Promise<Session | null | undefined> {
  if (process.env.NODE_ENV === 'production') return undefined;
  return devSessionFromCookie((await cookies()).get(DEV_SESSION_COOKIE)?.value);
}

/**
 * The current viewer. In development a `dev-session` cookie can stand in for Auth.js;
 * otherwise this reads the Auth.js session (Discord login, roles from the guild).
 * Reads cookies, so a page that calls it renders dynamically.
 */
export async function getSession(): Promise<Session | null> {
  const stub = await getDevStubSession();
  if (stub !== undefined) return stub && { ...stub, availabilitySubmitted: await hasAvailability(stub.discordId) };

  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    discordId: session.user.id,
    role: session.user.role,
    name: session.user.name ?? 'Member',
    avatarUrl: session.user.image ?? undefined,
    rank: RANK_FOR_ROLE[session.user.role],
    availabilitySubmitted: await hasAvailability(session.user.id),
    pendingApplications: 0,
  };
}

/** Whether this member has painted a week. A database failure reads as "not yet", never as an error on every page. */
async function hasAvailability(discordId: string): Promise<boolean> {
  try {
    return (await db.availability.count({ where: { user: { discordId } } })) > 0;
  } catch {
    return false;
  }
}
