import { cache } from 'react';
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
  /** Holds the Guild Master or Administrator Discord role: may delete raid templates. Grants nothing else. */
  templateAdmin: boolean;
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
 * The current viewer: the Auth.js session (Discord login, roles from the guild) when
 * there is one; in development a `dev-session` cookie stands in when there is not.
 * Reads cookies, so a page that calls it renders dynamically. Memoized per request with
 * React's cache(), so several calls in one render share one database read.
 */
export const getSession = cache(async function getSession(): Promise<Session | null> {
  // A real Discord login always wins; the dev stub only fills in when nobody is logged in.
  const session = await auth();
  if (!session?.user?.id) {
    const stub = await getDevStubSession();
    if (stub !== undefined) {
      if (!stub) return null;
      const [availabilitySubmitted, pendingApplications] = await counts(stub.discordId, stub.role);
      return { ...stub, availabilitySubmitted, pendingApplications };
    }
    return null;
  }
  const [availabilitySubmitted, pendingApplications] = await counts(session.user.id, session.user.role);
  return {
    discordId: session.user.id,
    role: session.user.role,
    templateAdmin: session.user.templateAdmin === true,
    name: session.user.name ?? 'Member',
    avatarUrl: session.user.image ?? undefined,
    rank: RANK_FOR_ROLE[session.user.role],
    availabilitySubmitted,
    pendingApplications,
  };
});

/** The two per-request reads, in parallel: has this member painted, and (officers) how many applications wait. */
function counts(discordId: string, role: Role): Promise<[boolean, number]> {
  return Promise.all([hasAvailability(discordId), role === 'officer' ? pendingApplications() : Promise.resolve(0)]);
}

/** Officers only: the count badge in the nav (docs/02 § SiteHeader). A database failure reads as none. */
async function pendingApplications(): Promise<number> {
  try {
    return await db.application.count({ where: { status: 'PENDING' } });
  } catch {
    return 0;
  }
}

/** Whether this member has painted a week. A database failure reads as "not yet", never as an error on every page. */
async function hasAvailability(discordId: string): Promise<boolean> {
  try {
    return (await db.availability.count({ where: { user: { discordId } } })) > 0;
  } catch {
    return false;
  }
}
