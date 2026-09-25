import { describe, expect, it } from 'vitest';
import type { GuildLookup } from './discord';
import { asNumber, asRole, claimsForSignIn, refreshClaims, ROLE_GRACE_MS, ROLE_RETRY_MS, ROLE_TTL_MS } from './token-roles';

const IDS = { officer: 'r-officer', member: 'r-member' };
const NOW = 1_800_000_000_000;

const member = (roles: string[]): GuildLookup => ({ kind: 'member', member: { roles, nick: null } });
const ABSENT: GuildLookup = { kind: 'absent' };
const ERROR: GuildLookup = { kind: 'error', status: 503 };
const returning = (result: GuildLookup) => async () => result;

describe('claimsForSignIn', () => {
  it('maps guild roles through the one mapping', async () => {
    const c = await claimsForSignIn('123', { username: 'red' }, IDS, returning(member(['r-officer'])), NOW);
    expect(c).toEqual({ discordId: '123', role: 'officer', name: 'red', rolesCheckedAt: NOW, rolesRetryAt: 0 });
  });

  it('is social when not in the guild or when the lookup fails: no established role to keep', async () => {
    expect((await claimsForSignIn('123', {}, IDS, returning(ABSENT), NOW)).role).toBe('social');
    expect((await claimsForSignIn('123', {}, IDS, returning(ERROR), NOW)).role).toBe('social');
  });

  it('ignores Administrator-only members', async () => {
    expect((await claimsForSignIn('123', {}, IDS, returning(member(['r-admin'])), NOW)).role).toBe('social');
  });
});

describe('refreshClaims', () => {
  const token = (over: Record<string, unknown>) => ({ discordId: '123', role: 'officer', rolesCheckedAt: NOW - 1000, rolesRetryAt: 0, ...over });
  const expired = NOW - ROLE_TTL_MS - 1;

  it('keeps the role while the TTL has not passed and does not call Discord', async () => {
    let calls = 0;
    const spy = async () => {
      calls++;
      return member([]);
    };
    const r = await refreshClaims(token({}), IDS, spy, NOW);
    expect(r).toEqual({ role: 'officer', rolesCheckedAt: NOW - 1000, rolesRetryAt: 0 });
    expect(calls).toBe(0);
  });

  it('re-reads roles after the TTL and demotes when the role is gone', async () => {
    const r = await refreshClaims(token({ rolesCheckedAt: expired }), IDS, returning(member(['r-member'])), NOW);
    expect(r).toEqual({ role: 'member', rolesCheckedAt: NOW, rolesRetryAt: 0 });
  });

  it('demotes to social when Discord says the member left the guild', async () => {
    const r = await refreshClaims(token({ rolesCheckedAt: expired }), IDS, returning(ABSENT), NOW);
    expect(r).toEqual({ role: 'social', rolesCheckedAt: NOW, rolesRetryAt: 0 });
  });

  it('keeps an established role through a Discord failure within the grace window and backs off', async () => {
    const r = await refreshClaims(token({ rolesCheckedAt: expired }), IDS, returning(ERROR), NOW);
    expect(r).toEqual({ role: 'officer', rolesCheckedAt: expired, rolesRetryAt: NOW + ROLE_RETRY_MS });
  });

  it('does not retry before the back-off has passed', async () => {
    let calls = 0;
    const spy = async () => {
      calls++;
      return member(['r-member']);
    };
    const r = await refreshClaims(token({ rolesCheckedAt: expired, rolesRetryAt: NOW + 1000 }), IDS, spy, NOW);
    expect(calls).toBe(0);
    expect(r.role).toBe('officer');
  });

  it('demotes to social once a failure has lasted past the grace window', async () => {
    const stale = NOW - ROLE_GRACE_MS - 1;
    const r = await refreshClaims(token({ rolesCheckedAt: stale }), IDS, returning(ERROR), NOW);
    expect(r.role).toBe('social');
    expect(r.rolesRetryAt).toBe(NOW + ROLE_RETRY_MS);
  });

  it('never promotes on a failure: a social stays social', async () => {
    const r = await refreshClaims(token({ role: 'social', rolesCheckedAt: expired }), IDS, returning(ERROR), NOW);
    expect(r.role).toBe('social');
  });

  it('treats a token without a Discord id as social', async () => {
    const r = await refreshClaims({ role: 'officer' }, IDS, returning(member(['r-officer'])), NOW);
    expect(r.role).toBe('social');
  });

  it('never trusts a malformed role or timestamp on the token', async () => {
    expect(asRole('admin')).toBe('social');
    expect(asRole(undefined)).toBe('social');
    expect(asNumber('9999999999999')).toBe(0);
    expect(asNumber(Number.NaN)).toBe(0);
    // A garbage timestamp counts as expired, so roles are re-read rather than trusted.
    const r = await refreshClaims(token({ role: 'admin', rolesCheckedAt: 'yesterday' }), IDS, returning(member(['r-member'])), NOW);
    expect(r).toEqual({ role: 'member', rolesCheckedAt: NOW, rolesRetryAt: 0 });
  });
});
