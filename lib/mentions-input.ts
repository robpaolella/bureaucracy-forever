/**
 * What the Discord tags in a note or relay message point to, as the bot sends them
 * (SYNC-SPEC §4, Mentions). Pure, so the limits are unit-tested apart from the routes.
 */
export const MENTION_NAME_MAX = 100;
export const MENTIONS_PER_KIND_MAX = 50;
export const ROLE_COLOR_MAX = 0xffffff;

const SNOWFLAKE = /^\d{17,20}$/;

/** `name` is the person's server display name, the role's name or the channel's name; `color` is Discord's role colour, 0 for none. */
export type Mentions = {
  users?: Record<string, { name: string }>;
  roles?: Record<string, { name: string; color: number }>;
  channels?: Record<string, { name: string }>;
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 1–100 characters, counting code points so an emoji is one. */
const isName = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && [...v].length <= MENTION_NAME_MAX;
const isColor = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= ROLE_COLOR_MAX;

/** One entry with only its known fields, or null when it breaks the rule below. */
const ENTRY = {
  users: (v: Record<string, unknown>) => (isName(v.name) ? { name: v.name } : null),
  roles: (v: Record<string, unknown>) => (isName(v.name) && isColor(v.color) ? { name: v.name, color: v.color } : null),
  channels: (v: Record<string, unknown>) => (isName(v.name) ? { name: v.name } : null),
};
const ENTRY_RULE = {
  users: `a name of 1 to ${MENTION_NAME_MAX} characters`,
  roles: `a name of 1 to ${MENTION_NAME_MAX} characters and a color from 0 to ${ROLE_COLOR_MAX}`,
  channels: `a name of 1 to ${MENTION_NAME_MAX} characters`,
};

/**
 * The optional `mentions` field of a bot body, or the `error` for a 400. Absent (or null) is
 * `null`, as is a value with no entries, so the site uses its own fallback. Unknown keys are
 * dropped.
 */
export function parseMentions(raw: unknown): { ok: true; mentions: Mentions | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, mentions: null };
  if (!isRecord(raw)) return { ok: false, error: 'mentions must be an object.' };
  const mentions: Record<string, Record<string, unknown>> = {};
  for (const kind of ['users', 'roles', 'channels'] as const) {
    const map = raw[kind];
    if (map === undefined) continue;
    if (!isRecord(map)) return { ok: false, error: `mentions.${kind} must be an object.` };
    const ids = Object.keys(map);
    if (ids.length > MENTIONS_PER_KIND_MAX) return { ok: false, error: `mentions.${kind} has over ${MENTIONS_PER_KIND_MAX} entries.` };
    const out: Record<string, unknown> = {};
    for (const id of ids) {
      if (!SNOWFLAKE.test(id)) return { ok: false, error: `mentions.${kind} keys must be Discord ids.` };
      const entry = map[id];
      const parsed = isRecord(entry) ? ENTRY[kind](entry) : null;
      if (!parsed) return { ok: false, error: `Each of mentions.${kind} needs ${ENTRY_RULE[kind]}.` };
      out[id] = parsed;
    }
    if (ids.length > 0) mentions[kind] = out;
  }
  return { ok: true, mentions: Object.keys(mentions).length > 0 ? (mentions as Mentions) : null };
}
