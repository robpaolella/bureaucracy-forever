import { describe, expect, it } from 'vitest';
import { isTemplateAdmin, roleFromDiscordRoles, roleIdsFromEnv, templateAdminIdsFromEnv } from './roles';

const IDS = { officer: '100', member: '200' };
const ADMIN = '900'; // a hypothetical Discord Administrator role id

describe('roleFromDiscordRoles', () => {
  it('officer role alone grants officer', () => {
    expect(roleFromDiscordRoles(['100'], IDS)).toBe('officer');
  });

  it('officer wins over member when both are held', () => {
    expect(roleFromDiscordRoles(['200', '100'], IDS)).toBe('officer');
  });

  it('member role alone grants member', () => {
    expect(roleFromDiscordRoles(['200'], IDS)).toBe('member');
  });

  it('no mapped roles is social', () => {
    expect(roleFromDiscordRoles([], IDS)).toBe('social');
    expect(roleFromDiscordRoles(['123', '456'], IDS)).toBe('social');
  });

  it('Administrator grants nothing: admin alone is social', () => {
    expect(roleFromDiscordRoles([ADMIN], IDS)).toBe('social');
  });

  it('Administrator grants nothing: admin plus member is member, not officer', () => {
    expect(roleFromDiscordRoles([ADMIN, '200'], IDS)).toBe('member');
  });

  it('matches ids exactly, not by prefix or substring', () => {
    expect(roleFromDiscordRoles(['1000'], IDS)).toBe('social');
    expect(roleFromDiscordRoles(['10'], IDS)).toBe('social');
  });
});

describe('roleIdsFromEnv', () => {
  it('reads the two ids', () => {
    expect(roleIdsFromEnv({ DISCORD_ROLE_OFFICER: 'a', DISCORD_ROLE_MEMBER: 'b' })).toEqual({
      officer: 'a',
      member: 'b',
    });
  });

  it('throws when either is missing', () => {
    expect(() => roleIdsFromEnv({ DISCORD_ROLE_OFFICER: 'a' })).toThrow();
    expect(() => roleIdsFromEnv({ DISCORD_ROLE_MEMBER: 'b' })).toThrow();
  });

  it('has no admin variable', () => {
    const ids = roleIdsFromEnv({
      DISCORD_ROLE_OFFICER: 'a',
      DISCORD_ROLE_MEMBER: 'b',
      DISCORD_ROLE_ADMIN: 'c',
    });
    expect(Object.keys(ids).sort()).toEqual(['member', 'officer']);
  });
});

describe('template admins', () => {
  const ADMINS = ['300', '400']; // Guild Master, Administrator

  it('Guild Master or Administrator may delete templates', () => {
    expect(isTemplateAdmin(['300'], ADMINS)).toBe(true);
    expect(isTemplateAdmin(['200', '400'], ADMINS)).toBe(true);
  });

  it('an officer without either role may not, and ids match exactly', () => {
    expect(isTemplateAdmin(['100'], ADMINS)).toBe(false);
    expect(isTemplateAdmin(['3000', '40'], ADMINS)).toBe(false);
  });

  it('does not change the access level: Administrator alone is still social', () => {
    expect(roleFromDiscordRoles(['400'], IDS)).toBe('social');
  });

  it('reads whichever of the two ids are set and needs neither', () => {
    expect(templateAdminIdsFromEnv({ DISCORD_ROLE_GUILD_MASTER: 'g', DISCORD_ROLE_ADMINISTRATOR: 'a' })).toEqual(['g', 'a']);
    expect(templateAdminIdsFromEnv({ DISCORD_ROLE_ADMINISTRATOR: 'a' })).toEqual(['a']);
    expect(templateAdminIdsFromEnv({})).toEqual([]);
    expect(isTemplateAdmin(['g'], [])).toBe(false);
  });
});
