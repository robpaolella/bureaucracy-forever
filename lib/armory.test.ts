import { describe, expect, it, vi } from 'vitest';
import { armorySettings, createArmoryClient, profileUrl, ARMORY_TOKEN_URL } from './armory';
import { json, notFoundReply, profileReply, SAMPLE_TOKEN, tokenReply } from './armory.fixtures';

const settings = { clientId: 'id', clientSecret: 'secret' };

/** A fetch that answers the token request with `token` and profile requests with `profiles` in turn. */
function fake(profiles: (() => Response | Promise<Response>)[], token = () => json(200, tokenReply)) {
  const queue = [...profiles];
  return vi.fn(async (url: string | URL | Request) => (String(url) === ARMORY_TOKEN_URL ? token() : queue.shift()!()));
}

describe('armorySettings', () => {
  it('needs both keys', () => {
    expect(armorySettings({})).toBeNull();
    expect(armorySettings({ BLIZZARD_CLIENT_ID: 'id', BLIZZARD_CLIENT_SECRET: ' ' })).toBeNull();
    expect(armorySettings({ BLIZZARD_CLIENT_ID: ' id ', BLIZZARD_CLIENT_SECRET: 'secret' })).toEqual(settings);
  });
});

describe('profileUrl', () => {
  it('lowercases the name, joins it with a hyphen and uses the Forever namespace', () => {
    expect(profileUrl(' Sample  Name ')).toBe('https://us.api.blizzard.com/profile/wow/character/sample-name?namespace=profile-forever-us');
  });
});

describe('lookupLevel', () => {
  it('reads the level from a 200', async () => {
    const fetch = fake([() => json(200, profileReply)]);
    const client = createArmoryClient(settings, { fetch });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'found', level: 58, status: 200 });
    const [tokenCall, profileCall] = fetch.mock.calls as unknown as [string, RequestInit][];
    expect(tokenCall[1].headers).toMatchObject({ authorization: `Basic ${Buffer.from('id:secret').toString('base64')}` });
    expect(tokenCall[1].body).toBe('grant_type=client_credentials');
    expect(profileCall[0]).toBe(profileUrl('Sample Name'));
    expect(profileCall[1].headers).toEqual({ authorization: `Bearer ${SAMPLE_TOKEN}` });
  });

  it('maps 404 to not found', async () => {
    const client = createArmoryClient(settings, { fetch: fake([() => json(404, notFoundReply)]) });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'not-found', status: 404 });
  });

  it.each([429, 500, 503])('maps %i to failed', async (status) => {
    const client = createArmoryClient(settings, { fetch: fake([() => json(status, {})]) });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'failed', status });
  });

  it('fails a 200 without a usable level', async () => {
    const client = createArmoryClient(settings, { fetch: fake([() => json(200, { ...profileReply, level: undefined }), () => new Response('not json')]) });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'failed', status: 200 });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'failed', status: 200 });
  });

  it('gives up on a slow reply instead of waiting', async () => {
    const hang = (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });
    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => (String(url) === ARMORY_TOKEN_URL ? json(200, tokenReply) : hang(url, init)));
    const client = createArmoryClient(settings, { fetch, timeoutMs: 20 });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'failed' });
  });

  it('fails without throwing when the network or the token request fails', async () => {
    const offline = createArmoryClient(settings, { fetch: vi.fn(async () => { throw new TypeError('fetch failed'); }) });
    expect(await offline.lookupLevel('Sample Name')).toEqual({ kind: 'failed' });
    const refused = createArmoryClient(settings, { fetch: fake([], () => json(401, { error: 'invalid_client' })) });
    expect(await refused.lookupLevel('Sample Name')).toEqual({ kind: 'failed' });
    expect(await refused.checkKeys()).toBe(false);
  });
});

describe('token', () => {
  it('is cached until shortly before it expires, then fetched again', async () => {
    let clock = 0;
    const fetch = fake([0, 1, 2].map(() => () => json(200, profileReply)));
    const client = createArmoryClient(settings, { fetch, now: () => clock });
    await client.lookupLevel('Sample Name');
    clock = (tokenReply.expires_in - 61) * 1000;
    await client.lookupLevel('Sample Name');
    const tokenCalls = () => fetch.mock.calls.filter(([url]) => String(url) === ARMORY_TOKEN_URL).length;
    expect(tokenCalls()).toBe(1);
    clock = (tokenReply.expires_in - 59) * 1000;
    await client.lookupLevel('Sample Name');
    expect(tokenCalls()).toBe(2);
  });

  it('is dropped after Blizzard refuses it', async () => {
    const fetch = fake([() => json(401, {}), () => json(200, profileReply)]);
    const client = createArmoryClient(settings, { fetch });
    expect(await client.lookupLevel('Sample Name')).toEqual({ kind: 'failed', status: 401 });
    expect(await client.lookupLevel('Sample Name')).toMatchObject({ kind: 'found' });
    expect(fetch.mock.calls.filter(([url]) => String(url) === ARMORY_TOKEN_URL)).toHaveLength(2);
  });

  it('checkKeys asks for one token', async () => {
    const fetch = fake([]);
    expect(await createArmoryClient(settings, { fetch }).checkKeys()).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
