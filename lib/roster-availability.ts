import 'server-only';

import { unstable_cache } from 'next/cache';
import { normalizeWeek } from '@/lib/availability';
import { GUILD_TIMEZONE } from '@/lib/config';
import { db } from '@/lib/db';
import type { WowClass } from '@/lib/design/class-colors';
import type { HeatMember, HeatRole } from '@/lib/heatmap';

/** Cache tag for anything derived from the roster's painted weeks. PUT /api/availability expires it. */
export const HEATMAP_TAG = 'heatmap';

/**
 * The raiding roster with each member's painted week, if any. Socials are not asked for
 * availability (docs/03 § Roles) so they are not in the denominator. Cached for a minute
 * and expired on every availability write (docs/06 § API routes); the projection onto
 * the officer's zone happens per request, this read is the part worth caching.
 */
async function loadRosterAvailability(): Promise<HeatMember[]> {
  const users = await db.user.findMany({
    where: { role: { not: 'SOCIAL' } },
    orderBy: { discordName: 'asc' },
    select: {
      discordName: true,
      timezone: true,
      availability: { select: { timezone: true, slots: true } },
      characters: { where: { isMain: true }, take: 1, select: { name: true, class: true, raidRole: true } },
    },
  });
  return users.map((u) => {
    const main = u.characters[0];
    return {
      name: main?.name ?? u.discordName,
      wowClass: main ? (main.class.toLowerCase() as WowClass) : null,
      role: (main?.raidRole ?? 'MELEE').toLowerCase() as HeatRole,
      timezone: u.availability?.timezone ?? u.timezone ?? GUILD_TIMEZONE,
      slots: u.availability ? normalizeWeek(u.availability.slots) : null,
    };
  });
}

export const getRosterAvailability = unstable_cache(loadRosterAvailability, ['roster-availability'], { revalidate: 60, tags: [HEATMAP_TAG] });
