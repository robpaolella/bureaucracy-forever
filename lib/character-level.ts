/**
 * A character's stored level, read safely. Blizzard's API terms let the site keep character
 * data for at most 30 days, so a level whose last successful check is older reads as unknown
 * everywhere, even before anything clears it (#565). Read `Character.level` only through this.
 */
export const LEVEL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function freshLevel(
  character: { level: number | null; levelCheckedAt: Date | null },
  now: Date = new Date(),
  maxAgeMs: number = LEVEL_MAX_AGE_MS,
): number | null {
  const { level, levelCheckedAt } = character;
  if (level === null || !levelCheckedAt) return null;
  return now.getTime() - levelCheckedAt.getTime() <= maxAgeMs ? level : null;
}

/** The raid level: a known level under it is flagged to the bot as `underRaidLevel` (#569). */
export const RAID_LEVEL = 60;

/**
 * The bot's replies are stored for replay (lib/idempotency.ts), which scrubs their level after
 * LEVEL_REPLAY_SCRUB_AFTER_MS. A level handed to the bot is therefore at most this old, so a
 * stored copy is gone before the 30-day limit (lib/tick-retention.test.ts).
 */
export const LEVEL_BOT_MAX_AGE_MS = 29 * 24 * 60 * 60 * 1000;
export const LEVEL_REPLAY_SCRUB_AFTER_MS = 12 * 60 * 60 * 1000;

/** `level` and `underRaidLevel` for the bot (SYNC-SPEC §4): unknown or over 29 days old reads as null and false. */
export function levelForBot(character: { level: number | null; levelCheckedAt: Date | null }, now: Date = new Date()) {
  const level = freshLevel(character, now, LEVEL_BOT_MAX_AGE_MS);
  return { level, underRaidLevel: level !== null && level < RAID_LEVEL };
}

/** A name change that Blizzard sees: its lookup is case-blind, like the site's name rule. */
export const isRename = (before: string, after: string) => before.toLowerCase() !== after.toLowerCase();

/** Written with the new name on a rename, so the old name's level never shows for the new one. */
export const LEVEL_CLEARED = { level: null, levelCheckedAt: null, levelAttemptedAt: null } as const;
