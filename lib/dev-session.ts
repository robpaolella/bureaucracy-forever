/**
 * Dev-only stub sessions. A `dev-session` cookie picks one of the session states from
 * docs/03 so the header can be reviewed without three real Discord accounts. Set it via
 * /dev/session?as=… . Ignored entirely in production builds. Kept free of server-only
 * imports so proxy.ts can read it too.
 */
import type { Session } from '@/lib/session';

export const DEV_SESSION_COOKIE = 'dev-session';
export const DEV_SESSION_STATES = ['out', 'member', 'member-unsubmitted', 'officer'] as const;
export type DevSessionState = (typeof DEV_SESSION_STATES)[number];

const STUBS: Record<Exclude<DevSessionState, 'out'>, Session> = {
  member: {
    discordId: 'dev-member',
    role: 'member',
    name: 'Redtape',
    wowClass: 'priest',
    rank: 'raider',
    availabilitySubmitted: true,
    pendingApplications: 0,
  },
  'member-unsubmitted': {
    discordId: 'dev-member',
    role: 'member',
    name: 'Redtape',
    wowClass: 'priest',
    rank: 'raider',
    availabilitySubmitted: false,
    pendingApplications: 0,
  },
  officer: {
    discordId: 'dev-officer',
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

/**
 * `undefined` when no valid dev cookie is set (fall through to real auth), `null` for the
 * explicit logged-out state, otherwise the stub.
 */
export function devSessionFromCookie(value: string | undefined): Session | null | undefined {
  if (process.env.NODE_ENV === 'production') return undefined;
  if (!isDevSessionState(value)) return undefined;
  return value === 'out' ? null : STUBS[value];
}
