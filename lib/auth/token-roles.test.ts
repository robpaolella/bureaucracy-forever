import { describe, expect, it } from 'vitest';
import type { GuildMember } from './discord';
import { asNumber, asRole, claimsForSignIn, refreshClaims, ROLE_TTL_MS } from './token-roles';

const IDS = { officer: 'r-officer', member: 'r-member' };
const NOW = 1_800_000_000_000;

const member = (roles: string[]): GuildMember => ({ roles, nick: null, avatar: null });
const fetching =
  (result: GuildMember | null) =>
  async (): Promise<GuildMember | null> =>
    result;

describe('claimsForSignIn', () => {
  it('maps guild roles through the one mapping', async () => {
    const c = await claimsForSignIn('123', { username: 'red' }, IDS, fetching(member(['r-officer'])), NOW);
    expect(c).toEqual({ discordId: '123', role: 'officer', name: 'red', rolesCheckedAt: NOW });
  });

  it('is social when the member cannot be read', async () => {
    const c = await claimsForSignIn('123', { username: 'red' }, IDS, fetching(null), NOW);
    expect(c.role).toBe('social');
  });

  it('ignores Administrator-only members', async () => {
    const c = await claimsForSignIn('123', {}, IDS, fetching(member(['r-admin'])), NOW);
    expect(c.role).toBe('social');
  });
});

describe('refreshClaims', () => {
  const token = (over: Record<string, unknown>) => ({ discordId: '123', role: 'officer', rolesCheckedAt: NOW - 1000, ...over });

  it('keeps the role while the TTL has not passed and does not call Discord', async () => {
    let calls = 0;
    const spy = async () => {
      calls++;
      return member([]);
    };
    const r = await refreshClaims(token({}), IDS, spy, NOW);
    expect(r).toEqual({ role: 'officer', rolesCheckedAt: NOW - 1000 });
    expect(calls).toBe(0);
  });

  it('re-reads roles after the TTL and demotes when the role is gone', async () => {
    const r = await refreshClaims(token({ rolesCheckedAt: NOW - ROLE_TTL_MS - 1 }), IDS, fetching(member(['r-member'])), NOW);
    expect(r).toEqual({ role: 'member', rolesCheckedAt: NOW });
  });

  it('demotes to social when the refresh fails, never keeping stale privilege', async () => {
    const r = await refreshClaims(token({ rolesCheckedAt: 0 }), IDS, fetching(null), NOW);
    expect(r.role).toBe('social');
  });

  it('treats a token without a Discord id as social', async () => {
    const r = await refreshClaims({ role: 'officer' }, IDS, fetching(member(['r-officer'])), NOW);
    expect(r.role).toBe('social');
  });

  it('never trusts a malformed role or timestamp on the token', async () => {
    expect(asRole('admin')).toBe('social');
    expect(asRole(undefined)).toBe('social');
    expect(asNumber('9999999999999')).toBe(0);
    expect(asNumber(Number.NaN)).toBe(0);
    // A garbage timestamp counts as expired, so roles are re-read rather than trusted.
    const r = await refreshClaims(token({ role: 'admin', rolesCheckedAt: 'yesterday' }), IDS, fetching(member(['r-member'])), NOW);
    expect(r).toEqual({ role: 'member', rolesCheckedAt: NOW });
  });
});
