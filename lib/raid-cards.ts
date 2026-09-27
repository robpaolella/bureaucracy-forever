import 'server-only';
import { db } from '@/lib/db';
import type { Role } from '@/lib/design/class-colors';
import { countAccepted, parseRequirements, type RaidCard, type RaidResponse } from '@/lib/raids';

/**
 * Raids from `since` onward as calendar cards, with accepted counts per role from each
 * member's main and the viewer's own answer. Shared by the calendar page and GET /api/raids.
 */
export async function loadRaidCards(since: Date, viewerDiscordId: string | null): Promise<RaidCard[]> {
  const raids = await db.raid.findMany({
    where: { startsAt: { gte: since } },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      name: true,
      startsAt: true,
      durationMin: true,
      notes: true,
      cancelledAt: true,
      requirements: true,
      signups: { select: { response: true, user: { select: { discordId: true, characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } } },
    },
  });
  return raids.map((r) => {
    const signups = r.signups.map((s) => ({
      response: (s.response?.toLowerCase() as RaidResponse | undefined) ?? null,
      role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null,
      mine: viewerDiscordId !== null && s.user.discordId === viewerDiscordId,
    }));
    return {
      id: r.id,
      name: r.name,
      startsAt: r.startsAt.toISOString(),
      durationMin: r.durationMin,
      notes: r.notes,
      cancelled: r.cancelledAt !== null,
      requirements: parseRequirements(r.requirements),
      counts: countAccepted(signups),
      mine: signups.find((s) => s.mine)?.response ?? null,
    };
  });
}
