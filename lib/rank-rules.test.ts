import { describe, expect, it } from 'vitest';
import { inGuildFromDiscordRoles, memberState, memberUpdate, parseSnapshotMember, rankFromDiscordRoles, rankRoleIdsFromEnv, roleChangesForAccept, roleChangesForRank, sweepAllowed, trialCheckInDue, type RankRoleIds, type SyncedUser } from './rank-rules';

const IDS: RankRoleIds = { officer: 'O', member: 'M', raider: 'R', trial: 'T', social: 'S', guest: 'G' };

describe('rank from Discord roles', () => {
  it('reads Officer, then Trial, then Raider, else Social; membership needs Guild Member or Officer', () => {
    expect(rankFromDiscordRoles(['M', 'R'], IDS)).toBe('RAIDER');
    expect(rankFromDiscordRoles(['M', 'R', 'T'], IDS)).toBe('TRIAL');
    expect(rankFromDiscordRoles(['O', 'R'], IDS)).toBe('OFFICER');
    expect(rankFromDiscordRoles(['M', 'S'], IDS)).toBe('SOCIAL');
    expect(rankFromDiscordRoles(['M'], IDS)).toBe('SOCIAL');
    expect(inGuildFromDiscordRoles(['M'], IDS)).toBe(true);
    expect(inGuildFromDiscordRoles(['O'], IDS)).toBe(true);
    expect(inGuildFromDiscordRoles(['G', 'R'], IDS)).toBe(false);
  });

  it('refuses to judge rank at all when the Trial or Raider id is not configured', () => {
    expect(rankFromDiscordRoles(['M', 'R', 'T'], { officer: 'O', member: 'M' })).toBeNull();
    expect(rankFromDiscordRoles(['O'], { officer: 'O', member: 'M', raider: 'R' })).toBeNull();
  });
});

describe('roles from rank', () => {
  it('raiders and officers hold Raider, trials Raider and Trial, socials Social; Officer is never touched', () => {
    expect(roleChangesForRank('RAIDER', IDS)).toEqual({ add: ['R'], remove: ['T', 'S'] });
    expect(roleChangesForRank('OFFICER', IDS)).toEqual({ add: ['R'], remove: ['T', 'S'] });
    expect(roleChangesForRank('TRIAL', IDS)).toEqual({ add: ['R', 'T'], remove: ['S'] });
    expect(roleChangesForRank('SOCIAL', IDS)).toEqual({ add: ['S'], remove: ['R', 'T'] });
  });

  it('leaves out ids that are not configured', () => {
    expect(roleChangesForRank('TRIAL', { officer: 'O', member: 'M', raider: 'R' })).toEqual({ add: ['R'], remove: [] });
  });

  it('accepting adds Guild Member and drops Guest, with the rank roles of the path', () => {
    expect(roleChangesForAccept('raider', IDS)).toEqual({ add: ['M', 'R', 'T'], remove: ['G', 'S'] });
    expect(roleChangesForAccept('social', IDS)).toEqual({ add: ['M', 'S'], remove: ['G', 'R', 'T'] });
  });
});

describe('trial check-in', () => {
  const now = new Date('2026-10-15T00:00:00Z');
  it('is due fourteen days after the start, once, and only while the rank is still Trial', () => {
    expect(trialCheckInDue({ rank: 'TRIAL', trialStartedAt: new Date('2026-10-01T00:00:00Z'), trialNudgedAt: null }, now)).toBe(true);
    expect(trialCheckInDue({ rank: 'TRIAL', trialStartedAt: new Date('2026-10-02T00:00:01Z'), trialNudgedAt: null }, now)).toBe(false);
    expect(trialCheckInDue({ rank: 'TRIAL', trialStartedAt: new Date('2026-10-01T00:00:00Z'), trialNudgedAt: new Date() }, now)).toBe(false);
    expect(trialCheckInDue({ rank: 'RAIDER', trialStartedAt: new Date('2026-10-01T00:00:00Z'), trialNudgedAt: null }, now)).toBe(false);
    expect(trialCheckInDue({ rank: 'TRIAL', trialStartedAt: null, trialNudgedAt: null }, now)).toBe(false);
  });
});

describe('snapshot members', () => {
  it('accepts a Discord id, a name and role ids; drops anything else', () => {
    expect(parseSnapshotMember({ discordId: '202297378256977920', name: ' konvett ', roles: ['M', 7], avatarUrl: 'https://cdn.discordapp.com/a.png' })).toEqual({ discordId: '202297378256977920', name: 'konvett', avatarUrl: 'https://cdn.discordapp.com/a.png', roles: ['M'] });
    expect(parseSnapshotMember({ discordId: 'abc', name: 'x', roles: [] })).toBeNull();
    expect(parseSnapshotMember({ discordId: '202297378256977920', name: '', roles: [] })).toBeNull();
    expect(parseSnapshotMember({ discordId: '202297378256977920', name: 'x' })).toBeNull();
    expect(parseSnapshotMember({ discordId: '202297378256977920', name: 'x', roles: [], avatarUrl: 'javascript:alert(1)' })?.avatarUrl).toBeNull();
  });

  it('reads the optional role ids from the environment', () => {
    expect(rankRoleIdsFromEnv({ DISCORD_ROLE_OFFICER: 'O', DISCORD_ROLE_MEMBER: 'M', DISCORD_ROLE_TRIAL: '' })).toEqual({ officer: 'O', member: 'M', raider: undefined, trial: undefined, social: undefined, guest: undefined });
    expect(() => rankRoleIdsFromEnv({ DISCORD_ROLE_OFFICER: 'O' })).toThrow();
  });
});

describe('applying a snapshot entry', () => {
  const now = new Date('2026-10-01T00:00:00Z');
  const base: SyncedUser = { rank: 'RAIDER', role: 'MEMBER', inGuild: true, discordName: 'Konvett', avatarUrl: null, trialStartedAt: null };
  const entry = (roles: string[], name = 'Konvett') => ({ discordId: '202297378256977920', name, avatarUrl: null, roles });

  it('reads role, membership and rank from the roles', () => {
    expect(memberState(entry(['M', 'R']), IDS)).toEqual({ role: 'MEMBER', inGuild: true, rank: 'RAIDER' });
    expect(memberState(entry(['O']), IDS)).toEqual({ role: 'OFFICER', inGuild: true, rank: 'OFFICER' });
    expect(memberState(entry([]), IDS)).toEqual({ role: 'SOCIAL', inGuild: false, rank: 'SOCIAL' });
  });

  it('writes nothing when nothing changed', () => {
    expect(memberUpdate(base, entry(['M', 'R']), memberState(entry(['M', 'R']), IDS), false, now)).toBeNull();
  });

  it('keeps the rank while a web write is still on its way, but still takes the name', () => {
    expect(memberUpdate(base, entry(['M', 'S'], 'Konv'), memberState(entry(['M', 'S']), IDS), true, now)).toEqual({ discordName: 'Konv' });
  });

  it('leaves the rank alone when the ids cannot judge it', () => {
    const partial: RankRoleIds = { officer: 'O', member: 'M' };
    expect(memberUpdate(base, entry(['M']), memberState(entry(['M']), partial), false, now)).toBeNull();
  });

  it('starts the trial clock on entering Trial, keeps it while staying, clears it and the nudge on leaving', () => {
    expect(memberUpdate(base, entry(['M', 'R', 'T']), memberState(entry(['M', 'R', 'T']), IDS), false, now)).toEqual({ rank: 'TRIAL', trialStartedAt: now });
    const started = new Date('2026-09-20T00:00:00Z');
    const trial: SyncedUser = { ...base, rank: 'TRIAL', trialStartedAt: started };
    expect(memberUpdate(trial, entry(['M', 'R', 'T']), memberState(entry(['M', 'R', 'T']), IDS), false, now)).toBeNull();
    expect(memberUpdate(trial, entry(['M', 'R']), memberState(entry(['M', 'R']), IDS), false, now)).toEqual({ rank: 'RAIDER', trialStartedAt: null, trialNudgedAt: null });
  });

  it('records a leaver as out of the guild and social', () => {
    expect(memberUpdate(base, entry([]), memberState(entry([]), IDS), false, now)).toEqual({ role: 'SOCIAL', inGuild: false, rank: 'SOCIAL', trialStartedAt: null, trialNudgedAt: null });
  });

  it('refuses a sweep that would drop more than a quarter of a guild of eight or more', () => {
    expect(sweepAllowed(40, 0)).toBe(true);
    expect(sweepAllowed(40, 10)).toBe(true);
    expect(sweepAllowed(40, 11)).toBe(false);
    expect(sweepAllowed(5, 4)).toBe(true);
  });
});
