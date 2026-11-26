/**
 * A character's stored level, read safely. Blizzard's API terms let the site keep character
 * data for at most 30 days, so a level whose last successful check is older reads as unknown
 * everywhere, even before anything clears it (#565). Read `Character.level` only through this.
 */
export const LEVEL_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function freshLevel(
  character: { level: number | null; levelCheckedAt: Date | null },
  now: Date = new Date(),
): number | null {
  const { level, levelCheckedAt } = character;
  if (level === null || !levelCheckedAt) return null;
  return now.getTime() - levelCheckedAt.getTime() <= LEVEL_MAX_AGE_MS ? level : null;
}
