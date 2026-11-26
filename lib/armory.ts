/**
 * Reads a character's level from Blizzard's WoW Forever profile API (#565).
 *
 *   token:   POST https://oauth.battle.net/token (OAuth client credentials)
 *   profile: GET https://us.api.blizzard.com/profile/wow/character/{first}-{last}?namespace=profile-forever-us
 *
 * Forever has no realms and names are unique per region, so the path is the name alone,
 * lowercased, its space a hyphen (Blizzard's API forum, us.forums.blizzard.com/en/blizzard/t/60334).
 *
 * No `server-only` here: prisma/armory-check.ts runs this under tsx, where that import throws.
 * The database half lives in lib/armory-store.ts. Nothing here throws, logs, or returns the
 * token or the secret.
 */

export const ARMORY_TOKEN_URL = 'https://oauth.battle.net/token';
export const ARMORY_API_ORIGIN = 'https://us.api.blizzard.com';
export const ARMORY_NAMESPACE = 'profile-forever-us';
/** Every call gives up after this long; a slow Blizzard must not hold up the caller. */
export const ARMORY_TIMEOUT_MS = 5000;
/** A token is dropped this long before Blizzard says it expires, so it never lapses mid-call. */
const TOKEN_MARGIN_MS = 60_000;

export type ArmorySettings = { clientId: string; clientSecret: string };

/**
 * `found`: 200 with a level. `not-found`: 404 (under level 10, never logged out, privacy setting,
 * or no such character). `failed`: anything else (429, 5xx, timeout, no token, a reply without
 * a level), so the caller keeps what it had. `status` is the profile reply's HTTP status, if any.
 */
export type ArmoryResult =
  | { kind: 'found'; level: number; status: number }
  | { kind: 'not-found'; status: number }
  | { kind: 'failed'; status?: number };

export type ArmoryClient = {
  /** True when Blizzard hands out a token for these keys. */
  checkKeys(): Promise<boolean>;
  lookupLevel(name: string): Promise<ArmoryResult>;
};

type Deps = { fetch?: typeof fetch; now?: () => number; timeoutMs?: number };

/** The keys from the environment, or null when either is missing: lookups are then skipped. */
export function armorySettings(env: Record<string, string | undefined> = process.env): ArmorySettings | null {
  const clientId = env.BLIZZARD_CLIENT_ID?.trim();
  const clientSecret = env.BLIZZARD_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** "First Last" → `/profile/wow/character/first-last?namespace=profile-forever-us`. */
export function profileUrl(name: string): string {
  const slug = name.trim().toLowerCase().split(/\s+/).map(encodeURIComponent).join('-');
  return `${ARMORY_API_ORIGIN}/profile/wow/character/${slug}?namespace=${ARMORY_NAMESPACE}`;
}

export function createArmoryClient(settings: ArmorySettings, deps: Deps = {}): ArmoryClient {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? ARMORY_TIMEOUT_MS;
  let cached: { token: string; expiresAt: number } | null = null;

  async function request(url: string, init: RequestInit = {}): Promise<Response | null> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch {
      return null;
    }
  }

  async function token(): Promise<string | null> {
    if (cached && now() < cached.expiresAt) return cached.token;
    cached = null;
    const basic = Buffer.from(`${settings.clientId}:${settings.clientSecret}`).toString('base64');
    const res = await request(ARMORY_TOKEN_URL, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    if (!res?.ok) return null;
    try {
      const body = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
      if (typeof body.access_token !== 'string' || !body.access_token) return null;
      const seconds = typeof body.expires_in === 'number' && body.expires_in > 0 ? body.expires_in : 0;
      cached = { token: body.access_token, expiresAt: now() + seconds * 1000 - TOKEN_MARGIN_MS };
      return body.access_token;
    } catch {
      return null;
    }
  }

  return {
    async checkKeys() {
      return (await token()) !== null;
    },
    async lookupLevel(name) {
      const accessToken = await token();
      if (!accessToken) return { kind: 'failed' };
      const res = await request(profileUrl(name), { headers: { authorization: `Bearer ${accessToken}` } });
      if (!res) return { kind: 'failed' };
      // A refused token: fetch a new one next time rather than retrying now.
      if (res.status === 401) cached = null;
      if (res.status === 404) return { kind: 'not-found', status: 404 };
      if (res.status !== 200) return { kind: 'failed', status: res.status };
      try {
        const body = (await res.json()) as { level?: unknown };
        const level = body.level;
        if (typeof level === 'number' && Number.isInteger(level) && level >= 1) {
          return { kind: 'found', level, status: 200 };
        }
      } catch {
        // An unreadable body is a failure like any other.
      }
      return { kind: 'failed', status: 200 };
    },
  };
}
