/**
 * Blizzard replies for tests, scrubbed: sample token, sample client id, made-up character.
 * Shapes follow Blizzard's token and character profile replies; only `level` is read.
 */
export const SAMPLE_TOKEN = 'sample-access-token-0000';

export const tokenReply = {
  access_token: SAMPLE_TOKEN,
  token_type: 'bearer',
  expires_in: 86399,
  sub: 'sample-client-id',
};

export const profileReply = {
  _links: { self: { href: 'https://us.api.blizzard.com/profile/wow/character/sample-name?namespace=profile-forever-us' } },
  id: 1234567,
  name: 'Sample Name',
  gender: { type: 'FEMALE', name: 'Female' },
  faction: { type: 'ALLIANCE', name: 'Alliance' },
  race: { id: 1, name: 'Human' },
  character_class: { id: 2, name: 'Paladin' },
  active_spec: { id: 65, name: 'Holy' },
  level: 58,
  experience: 0,
  last_login_timestamp: 1764000000000,
};

export const notFoundReply = { code: 404, type: 'BLZWEBAPI00000404', detail: 'Not Found' };

export const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
