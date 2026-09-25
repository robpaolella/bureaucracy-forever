import { describe, expect, it } from 'vitest';
import { displayName, fetchGuildMember, type GuildMember } from './discord';
import { roleFromDiscordRoles } from './roles';

const ENV = { DISCORD_BOT_TOKEN: 'bot-token', DISCORD_GUILD_ID: '111' };
const IDS = { officer: 'r-officer', member: 'r-member' };

function fakeFetch(status: number, body: unknown, capture?: { url?: string; auth?: string }): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (capture) {
      capture.url = String(input);
      capture.auth = (init?.headers as Record<string, string>)?.Authorization;
    }
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

describe('fetchGuildMember', () => {
  it('reads roles, nick and avatar and nothing else', async () => {
    const capture: { url?: string; auth?: string } = {};
    const member = await fetchGuildMember(
      '123456789',
      ENV,
      fakeFetch(200, { roles: ['r-member', 'r-admin'], nick: 'Redtape', avatar: null, permissions: '8', user: { id: '123456789' } }, capture),
    );
    expect(member).toEqual({ roles: ['r-member', 'r-admin'], nick: 'Redtape', avatar: null });
    expect(capture.url).toBe('https://discord.com/api/v10/guilds/111/members/123456789');
    expect(capture.auth).toBe('Bot bot-token');
  });

  it('returns null when the user is not in the guild', async () => {
    expect(await fetchGuildMember('123456789', ENV, fakeFetch(404, { message: 'Unknown Member' }))).toBeNull();
  });

  it('returns null on a network failure rather than throwing', async () => {
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await fetchGuildMember('123456789', ENV, failing)).toBeNull();
  });

  it('rejects ids that are not Discord snowflakes without calling the API', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await fetchGuildMember('../guilds/x', ENV, spy)).toBeNull();
    expect(called).toBe(false);
  });

  it('throws when the bot token or guild id is missing', async () => {
    await expect(fetchGuildMember('123456789', { DISCORD_GUILD_ID: '111' }, fakeFetch(200, {}))).rejects.toThrow();
  });
});

describe('role derivation from a fetched member', () => {
  it('an Administrator who is not Officer or Guild Member is social', async () => {
    const member = await fetchGuildMember('123456789', ENV, fakeFetch(200, { roles: ['r-admin'], permissions: '8' }));
    expect(roleFromDiscordRoles(member!.roles, IDS)).toBe('social');
  });

  it('someone not in the guild is social', () => {
    const notInGuild = (): GuildMember | null => null;
    const member = notInGuild();
    expect(roleFromDiscordRoles(member?.roles ?? [], IDS)).toBe('social');
  });

  it('Officer role grants officer', async () => {
    const member = await fetchGuildMember('123456789', ENV, fakeFetch(200, { roles: ['r-officer'] }));
    expect(roleFromDiscordRoles(member!.roles, IDS)).toBe('officer');
  });
});

describe('displayName', () => {
  it('prefers the guild nickname, then the display name, then the username', () => {
    expect(displayName({ roles: [], nick: 'Redtape', avatar: null }, { global_name: 'Red', username: 'red_tape' })).toBe('Redtape');
    expect(displayName({ roles: [], nick: null, avatar: null }, { global_name: 'Red', username: 'red_tape' })).toBe('Red');
    expect(displayName(null, { global_name: null, username: 'red_tape' })).toBe('red_tape');
    expect(displayName(null, {})).toBe('Member');
  });
});
