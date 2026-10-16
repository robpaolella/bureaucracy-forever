/**
 * The minimum an applicant's times must reach (SYNC-SPEC §12, Time rules): at least
 * MIN_BLOCKS one-hour blocks on at least MIN_DAYS different guild days. Pure and free of
 * database and server-only code, so the server and the picker's footer count the same way.
 */
import { GUILD_TIMEZONE } from '@/lib/config';
import { zonedParts } from '@/lib/time';

export const MIN_BLOCKS = 5;
export const MIN_DAYS = 2;

/**
 * Count the blocks and guild days a set of picked half-hour starts covers. A block is a
 * guild-clock hour holding at least one pick, so the two starts of one hour count once, and a
 * window-edge block with only one start still counts. A guild day is a date in `GUILD_TIMEZONE`.
 */
export function countBlocks(picks: Date[]): { blocks: number; days: number } {
  const blocks = new Set<string>();
  const days = new Set<string>();
  for (const pick of picks) {
    const p = zonedParts(pick, GUILD_TIMEZONE);
    const day = `${p.year}-${p.month}-${p.day}`;
    days.add(day);
    blocks.add(`${day}-${p.hour}`);
  }
  return { blocks: blocks.size, days: days.size };
}

/** Plain words for what is missing, or null when the picks meet the minimum. */
export function minimumShortfall(picks: Date[]): string | null {
  const { blocks, days } = countBlocks(picks);
  if (blocks >= MIN_BLOCKS && days >= MIN_DAYS) return null;
  const missing: string[] = [];
  if (blocks < MIN_BLOCKS) missing.push(`${MIN_BLOCKS - blocks} more one-hour ${MIN_BLOCKS - blocks === 1 ? 'block' : 'blocks'}`);
  if (days < MIN_DAYS) missing.push(`at least ${MIN_DAYS} different days`);
  return `Pick at least ${MIN_BLOCKS} one-hour blocks on ${MIN_DAYS} or more different days. You need ${missing.join(' and ')}.`;
}
