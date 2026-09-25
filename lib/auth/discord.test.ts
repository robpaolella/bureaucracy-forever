import { describe, expect, it } from 'vitest';
import { displayName, lookupGuildMember } from './discord';
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

describe('lookupGuildMember', () => {
  it('reads roles and nick and nothing else', async () => {
    const capture: { url?: string; auth?: string } = {};
    const r = await lookupGuildMember(
      '123456789',
      ENV,
      fakeFetch(200, { roles: ['r-member', 'r-admin'], nick: 'Redtape', avatar: 'abc', permissions: '8', user: { id: '123456789' } }, capture),
    );
    expect(r).toEqual({ kind: 'member', member: { roles: ['r-member', 'r-admin'], nick: 'Redtape' } });
    expect(capture.url).toBe('https://discord.com/api/v10/guilds/111/members/123456789');
    expect(capture.auth).toBe('Bot bot-token');
  });

  it('is a definite "absent" when Discord says 404', async () => {
    expect(await lookupGuildMember('123456789', ENV, fakeFetch(404, { message: 'Unknown Member' }))).toEqual({ kind: 'absent' });
  });

  it('is an error, not an absence, on rate limits, outages, bad tokens and network failures', async () => {
    expect(await lookupGuildMember('123456789', ENV, fakeFetch(429, {}))).toEqual({ kind: 'error', status: 429 });
    expect(await lookupGuildMember('123456789', ENV, fakeFetch(503, {}))).toEqual({ kind: 'error', status: 503 });
    expect(await lookupGuildMember('123456789', ENV, fakeFetch(401, {}))).toEqual({ kind: 'error', status: 401 });
    const failing = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await lookupGuildMember('123456789', ENV, failing)).toEqual({ kind: 'error' });
  });

  it('rejects ids that are not Discord snowflakes without calling the API', async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    expect(await lookupGuildMember('../guilds/x', ENV, spy)).toEqual({ kind: 'absent' });
    expect(called).toBe(false);
  });

  it('throws when the bot token or guild id is missing', async () => {
    await expect(lookupGuildMember('123456789', { DISCORD_GUILD_ID: '111' }, fakeFetch(200, {}))).rejects.toThrow();
  });
});

describe('role derivation from a lookup', () => {
  it('an Administrator who is not Officer or Guild Member is social', async () => {
    const r = await lookupGuildMember('123456789', ENV, fakeFetch(200, { roles: ['r-admin'], permissions: '8' }));
    expect(r.kind).toBe('member');
    expect(roleFromDiscordRoles(r.kind === 'member' ? r.member.roles : [], IDS)).toBe('social');
  });

  it('Officer role grants officer', async () => {
    const r = await lookupGuildMember('123456789', ENV, fakeFetch(200, { roles: ['r-officer'] }));
    expect(roleFromDiscordRoles(r.kind === 'member' ? r.member.roles : [], IDS)).toBe('officer');
  });
});

describe('displayName', () => {
  it('prefers the guild nickname, then the display name, then the username', () => {
    expect(displayName({ roles: [], nick: 'Redtape' }, { global_name: 'Red', username: 'red_tape' })).toBe('Redtape');
    expect(displayName({ roles: [], nick: null }, { global_name: 'Red', username: 'red_tape' })).toBe('Red');
    expect(displayName(null, { global_name: null, username: 'red_tape' })).toBe('red_tape');
    expect(displayName(null, {})).toBe('Member');
  });
});
