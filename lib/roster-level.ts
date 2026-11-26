/**
 * How a character's level reads on the site. `level` is always the fresh one from
 * `freshLevel` (lib/character-level.ts): null means unknown, whether never looked up or
 * older than 30 days.
 */
import { RAID_LEVEL } from '@/lib/character-level';

/** A known level under the raid level: the only case that asks before a sign-up or shows on a raid page row. */
export const isUnderRaidLevel = (level: number | null): level is number => level !== null && level < RAID_LEVEL;

/** "Level 52", or "Level unknown" with no reason given. */
export const levelText = (level: number | null): string => (level === null ? 'Level unknown' : `Level ${level}`);

/** A raid page row's meta line: the parts, plus the level only when it is known and under 60. Unknown shows nothing. */
export const raidRowMeta = (parts: (string | null)[], level: number | null): string =>
  [...parts, isUnderRaidLevel(level) ? levelText(level) : null].filter(Boolean).join(' · ');
