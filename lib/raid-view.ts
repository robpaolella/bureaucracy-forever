import 'server-only';

import { db } from '@/lib/db';
import type { Role } from '@/lib/design/class-colors';
import { parseRequirements, type RaidResponse, type RoleCounts } from '@/lib/raids';
import { countsForBars } from '@/lib/signup-rules';
import { SITE_URL } from '@/lib/config';

export type RaidView = {
  id: string;
  name: string;
  status: 'SCHEDULED' | 'LOCKED' | 'DONE' | 'CANCELLED';
  startsAt: string;
  endsAt: string;
  locksAt: string;
  durationMin: number;
  notes: string | null;
  /** Set when status is CANCELLED and the officer gave one. */
  cancelledReason: string | null;
  late: boolean;
  template: { name: string; short: string; size: number } | null;
  requirements: RoleCounts;
  /** Roster acceptances per role, for the composition bars. */
  bars: RoleCounts;
  counts: { accepted: number; tentative: number; declined: number; unanswered: number; bench: number; roster: number; attended: number };
  discord: { threadId: string | null; messageId: string | null };
  url: string;
  viewer: { standing: 'ROSTER' | 'BENCH'; response: RaidResponse | null } | null;
};

/** GET /api/bot/raids/:id (SYNC-SPEC §4): everything the embed needs, and the viewer's own standing when asked. */
export async function loadRaidView(id: string, viewerDiscordId: string | null): Promise<RaidView | null> {
  const r = await db.raid.findUnique({
    where: { id },
    select: {
      id: true, name: true, status: true, startsAt: true, locksAt: true, durationMin: true, notes: true, cancelReason: true, requirements: true, postedAt: true, discordThreadId: true, discordMessageId: true,
      template: { select: { name: true, short: true, size: true } },
      series: { select: { postAheadDays: true } },
      signups: { select: { standing: true, response: true, attended: true, user: { select: { discordId: true, characters: { where: { isMain: true }, take: 1, select: { raidRole: true } } } } } },
    },
  });
  if (!r) return null;
  const rows = r.signups.map((s) => ({ standing: s.standing, response: (s.response?.toLowerCase() as RaidResponse | undefined) ?? null, role: (s.user.characters[0]?.raidRole.toLowerCase() as Role | undefined) ?? null, attended: s.attended, discordId: s.user.discordId }));
  const roster = rows.filter((s) => s.standing === 'ROSTER');
  const mine = viewerDiscordId ? rows.find((s) => s.discordId === viewerDiscordId) : undefined;
  const postAhead = (r.series?.postAheadDays ?? 14) * 24 * 3_600_000;
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    startsAt: r.startsAt.toISOString(),
    endsAt: new Date(r.startsAt.getTime() + r.durationMin * 60_000).toISOString(),
    locksAt: r.locksAt.toISOString(),
    durationMin: r.durationMin,
    notes: r.notes,
    cancelledReason: r.status === 'CANCELLED' ? r.cancelReason : null,
    late: r.postedAt !== null && r.startsAt.getTime() - r.postedAt.getTime() < postAhead - 24 * 3_600_000,
    template: r.template,
    requirements: parseRequirements(r.requirements),
    bars: countsForBars(rows) as RoleCounts,
    counts: {
      accepted: roster.filter((s) => s.response === 'accept').length,
      tentative: rows.filter((s) => s.response === 'tentative').length,
      declined: rows.filter((s) => s.response === 'absent').length,
      unanswered: roster.filter((s) => s.response === null).length,
      bench: rows.filter((s) => s.standing === 'BENCH').length,
      roster: roster.length,
      attended: rows.filter((s) => s.attended === true).length,
    },
    discord: { threadId: r.discordThreadId, messageId: r.discordMessageId },
    url: `${SITE_URL}/members/calendar/${r.id}`,
    viewer: mine ? { standing: mine.standing, response: mine.response } : null,
  };
}
