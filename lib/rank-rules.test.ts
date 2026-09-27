import { describe, expect, it } from 'vitest';
import { inGuildFromDiscordRoles, parseSnapshotMember, rankFromDiscordRoles, rankRoleIdsFromEnv, roleChangesForAccept, roleChangesForRank, trialCheckInDue, type RankRoleIds } from './rank-rules';

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

  it('ignores the Trial and Raider roles when their ids are not configured', () => {
    const partial: RankRoleIds = { officer: 'O', member: 'M' };
    expect(rankFromDiscordRoles(['M', 'R', 'T'], partial)).toBe('SOCIAL');
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
    expect(parseSnapshotMember({ discordId: '202297378256977920', name: 'x', roles: [], avatarUrl: 'javascript:alert(1)' })?.avatarUrl).toBeNull();
  });

  it('reads the optional role ids from the environment', () => {
    expect(rankRoleIdsFromEnv({ DISCORD_ROLE_OFFICER: 'O', DISCORD_ROLE_MEMBER: 'M', DISCORD_ROLE_TRIAL: '' })).toEqual({ officer: 'O', member: 'M', raider: undefined, trial: undefined, social: undefined, guest: undefined });
    expect(() => rankRoleIdsFromEnv({ DISCORD_ROLE_OFFICER: 'O' })).toThrow();
  });
});
