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
      status: true,
      locksAt: true,
      template: { select: { short: true } },
      signups: { select: { response: true, standing: true, user: { select: { discordId: true, characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } } },
    },
  });
  return raids.map((r) => {
    const signups = r.signups.map((s) => ({
      // Composition counts roster acceptances only (SYNC-SPEC §7); bench answers do not fill a slot.
      response: s.standing === 'ROSTER' ? ((s.response?.toLowerCase() as RaidResponse | undefined) ?? null) : null,
      ownResponse: (s.response?.toLowerCase() as RaidResponse | undefined) ?? null,
      standing: s.standing,
      role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null,
      mine: viewerDiscordId !== null && s.user.discordId === viewerDiscordId,
    }));
    const me = signups.find((s) => s.mine);
    return {
      id: r.id,
      name: r.name,
      startsAt: r.startsAt.toISOString(),
      durationMin: r.durationMin,
      notes: r.notes,
      cancelled: r.cancelledAt !== null,
      requirements: parseRequirements(r.requirements),
      counts: countAccepted(signups),
      mine: me?.ownResponse ?? null,
      status: r.status,
      locksAt: r.locksAt.toISOString(),
      short: r.template?.short ?? null,
      onRoster: me?.standing === 'ROSTER',
    };
  });
}
