import { cookies } from 'next/headers';
import type { Rank } from '@/components/ui/Badges';
import type { WowClass } from '@/lib/design/class-colors';

/** Access level, derived from Discord guild roles at sign-in (docs/03 § Roles). */
export type Role = 'social' | 'member' | 'officer';

export type Session = {
  role: Role;
  /** Display name: the member's main character. */
  name: string;
  wowClass: WowClass;
  /** Display rank on the roster, stored separately from `role`. */
  rank: Rank;
  /** Drives the "Not submitted" note in the Members menu. */
  availabilitySubmitted: boolean;
  /** Officers only: pending applications, shown as a count badge. */
  pendingApplications: number;
};

/**
 * Dev-only stub. Until Auth.js lands, a `dev-session` cookie picks one of the session
 * states from docs/03 so the header can be reviewed without three real Discord accounts.
 * Set it via /dev/session?as=… . Ignored entirely in production builds.
 */
export const DEV_SESSION_COOKIE = 'dev-session';
export const DEV_SESSION_STATES = ['out', 'member', 'member-unsubmitted', 'officer'] as const;
export type DevSessionState = (typeof DEV_SESSION_STATES)[number];

const STUBS: Record<Exclude<DevSessionState, 'out'>, Session> = {
  member: {
    role: 'member',
    name: 'Redtape',
    wowClass: 'priest',
    rank: 'raider',
    availabilitySubmitted: true,
    pendingApplications: 0,
  },
  'member-unsubmitted': {
    role: 'member',
    name: 'Redtape',
    wowClass: 'priest',
    rank: 'raider',
    availabilitySubmitted: false,
    pendingApplications: 0,
  },
  officer: {
    role: 'officer',
    name: 'Ledgerline',
    wowClass: 'warrior',
    rank: 'officer',
    availabilitySubmitted: true,
    pendingApplications: 7,
  },
};

export function isDevSessionState(value: string | undefined): value is DevSessionState {
  return (DEV_SESSION_STATES as readonly string[]).includes(value ?? '');
}

export async function getSession(): Promise<Session | null> {
  if (process.env.NODE_ENV === 'production') return null;
  const state = (await cookies()).get(DEV_SESSION_COOKIE)?.value;
  if (!isDevSessionState(state) || state === 'out') return null;
  return STUBS[state];
}
