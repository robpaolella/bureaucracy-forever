import 'server-only';

import { db } from '@/lib/db';
import { armorySettings, type ArmoryClient } from '@/lib/armory';
import { lookupAndStoreLevel } from '@/lib/armory-store';
import { LEVEL_MAX_AGE_MS, RAID_LEVEL } from '@/lib/character-level';

/** Characters looked up per tick. The tick runs every minute: up to 7,200 a day. */
export const REFRESH_BATCH = 5;
const HOUR = 60 * 60 * 1000;
/** A level under raid level is re-checked after this long, since it can change. */
export const REFRESH_AFTER_MS = 24 * HOUR;
/** Any level is re-checked after this long, well before the 30-day limit (lib/character-level.ts). */
export const REFRESH_MAX_AGE_MS = 25 * 24 * HOUR;

/**
 * SYNC-SPEC §6 step 16, keeping levels inside Blizzard's 30-day limit (#566). First it clears
 * every level last confirmed over 30 days ago (always, even without Blizzard keys). Then, with
 * keys, it looks up to `REFRESH_BATCH` due characters, oldest attempt first so one that keeps
 * failing goes to the back of the queue. The first failed lookup (429, 5xx, timeout) stops the
 * step for this tick; its attempt time is already stored, which backs that character off.
 * Returns how many were refreshed (Blizzard answered found or not found).
 */
export async function refreshCharacterLevels(now: Date, client?: ArmoryClient | null): Promise<number> {
  await db.character.updateMany({
    where: { level: { not: null }, levelCheckedAt: { lt: new Date(now.getTime() - LEVEL_MAX_AGE_MS) } },
    data: { level: null, levelCheckedAt: null },
  });
  if (client === undefined && !armorySettings()) return 0;
  if (client === null) return 0;

  const due = await db.character.findMany({
    where: {
      OR: [
        { levelCheckedAt: null },
        { levelCheckedAt: { lt: new Date(now.getTime() - REFRESH_MAX_AGE_MS) } },
        { OR: [{ level: null }, { level: { lt: RAID_LEVEL } }], levelCheckedAt: { lt: new Date(now.getTime() - REFRESH_AFTER_MS) } },
      ],
    },
    orderBy: [{ levelAttemptedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    take: REFRESH_BATCH,
    select: { id: true },
  });
  let refreshed = 0;
  for (const { id } of due) {
    const outcome = await lookupAndStoreLevel(id, client, () => new Date());
    if (outcome === 'failed') break;
    if (outcome === 'found' || outcome === 'not-found') refreshed += 1;
  }
  return refreshed;
}
