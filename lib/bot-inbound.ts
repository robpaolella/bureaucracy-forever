/**
 * Payloads the bot sends the site (docs/06 § Discord bot sync). Pure parsing so the routes
 * stay thin and the shapes are tested.
 */
import { CLASSES, SPECS, type WowClass } from '@/lib/design/class-colors';
import { isRaidResponse, type RaidResponse } from '@/lib/raids';

const SNOWFLAKE = /^\d{17,20}$/;

export type BotRole = 'member' | 'officer' | 'social';

export type BotSignup = {
  /** The site's raid id, or the Discord scheduled event id the bot posted for it. */
  raidId: string | null;
  discordEventId: string | null;
  discordId: string;
  discordName: string;
  /** The member's access level from their guild roles; required for a Discord id the site has never seen. */
  role: BotRole | null;
  response: RaidResponse | null;
  reason: string | null;
  /** When the member clicked, unix seconds; an answer older than the stored row is ignored. */
  at: number | null;
};

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function parseBotSignup(body: unknown): Parsed<BotSignup> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const raidId = str(b.raidId, 64);
  const discordEventId = str(b.discordEventId, 32);
  if (!raidId && !discordEventId) return { ok: false, error: 'Send raidId or discordEventId.' };
  const discordId = str(b.discordId, 32);
  if (!discordId || !SNOWFLAKE.test(discordId)) return { ok: false, error: 'discordId must be a Discord user id.' };
  const discordName = str(b.discordName, 64);
  if (!discordName) return { ok: false, error: 'Send discordName.' };
  if (b.response !== null && !isRaidResponse(b.response)) return { ok: false, error: 'response must be "accept", "tentative", "absent" or null.' };
  const role = b.role === 'member' || b.role === 'officer' || b.role === 'social' ? b.role : null;
  if (b.role !== undefined && b.role !== null && !role) return { ok: false, error: 'role must be "member", "officer" or "social".' };
  const at = typeof b.at === 'number' && Number.isInteger(b.at) && b.at > 0 ? b.at : null;
  return { ok: true, value: { raidId, discordEventId, discordId, discordName, role, response: b.response as RaidResponse | null, reason: str(b.reason, 200), at } };
}

export type BotApplication = {
  path: 'raider' | 'social';
  discordId: string;
  discordName: string;
  character: string;
  wowClass: WowClass | null;
  spec: string | null;
  logsUrl: string | null;
  /** Free-text fields from the bot's modal: alts, referredBy, extra. */
  answers: Record<string, string>;
};

const CHARACTER = /^\p{L}{2,12}$/u;

export function parseBotApplication(body: unknown): Parsed<BotApplication> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const path = b.path === 'social' ? 'social' : b.path === 'raider' ? 'raider' : null;
  if (!path) return { ok: false, error: 'path must be "raider" or "social".' };
  const discordId = str(b.discordId, 32);
  if (!discordId || !SNOWFLAKE.test(discordId)) return { ok: false, error: 'discordId must be a Discord user id.' };
  const discordName = str(b.discordName, 64);
  if (!discordName) return { ok: false, error: 'Send discordName.' };
  const rawCharacter = str(b.character, 12) ?? '';
  if (!CHARACTER.test(rawCharacter)) return { ok: false, error: 'Character names are 2–12 letters.' };
  const character = rawCharacter.charAt(0).toUpperCase() + rawCharacter.slice(1).toLowerCase();

  let wowClass: WowClass | null = null;
  let spec: string | null = null;
  if (typeof b.wowClass === 'string' && (CLASSES as readonly string[]).includes(b.wowClass)) {
    wowClass = b.wowClass as WowClass;
    if (typeof b.spec === 'string' && SPECS[wowClass].some((s) => s.name === b.spec)) spec = b.spec;
  }
  let logsUrl: string | null = null;
  if (typeof b.logsUrl === 'string' && b.logsUrl.trim()) {
    try {
      const u = new URL(b.logsUrl.trim());
      if (/^https?:$/.test(u.protocol)) logsUrl = u.toString().slice(0, 500);
    } catch {
      /* not a URL: dropped, the officer sees the rest */
    }
  }
  const answers: Record<string, string> = {};
  for (const key of ['alts', 'referredBy', 'extra'] as const) {
    const v = str(b[key], 2000);
    if (v) answers[key] = v;
  }
  return { ok: true, value: { path, discordId, discordName, character, wowClass, spec, logsUrl, answers } };
}
