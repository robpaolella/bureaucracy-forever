/**
 * Events the site sends the bot (docs/06 § Discord bot sync, "Site → bot"): a raid created,
 * edited, cancelled or restored; a sign-up changed on the web; an application decided; an
 * availability nudge. Pure builders so the payload shapes are tested and stable.
 */
import type { RaidResponse, RoleCounts } from '@/lib/raids';

export type RaidSummary = { id: string; name: string; startsAt: string; durationMin: number; notes: string | null; cancelled: boolean; requirements: RoleCounts; discordEventId: string | null };

export type BotEvent =
  | { type: 'raid.created' | 'raid.updated' | 'raid.cancelled' | 'raid.restored'; raid: RaidSummary }
  | { type: 'signup.changed'; raidId: string; discordId: string; discordName: string; response: RaidResponse | null; source: 'web'; setBy: string | null; counts: RoleCounts }
  | { type: 'application.decided'; applicationId: string; status: 'accepted' | 'declined'; path: 'raider' | 'social'; character: string; discordId: string | null; discordName: string }
  | { type: 'availability.nudge'; members: { discordId: string; discordName: string }[] };

export type BotEnvelope = { event: BotEvent; sentAt: string; id: string };

/** Wrap an event with an id and time so the bot can dedupe a retried delivery. */
export function envelope(event: BotEvent, sentAt: Date, id: string): BotEnvelope {
  return { event, sentAt: sentAt.toISOString(), id };
}

export function raidSummary(r: { id: string; name: string; startsAt: Date; durationMin: number; notes: string | null; cancelledAt: Date | null; requirements: RoleCounts; discordEventId: string | null }): RaidSummary {
  return { id: r.id, name: r.name, startsAt: r.startsAt.toISOString(), durationMin: r.durationMin, notes: r.notes, cancelled: r.cancelledAt !== null, requirements: r.requirements, discordEventId: r.discordEventId };
}

/** '' in Application.discordId means the applicant never logged in: the bot gets null and must use the handle. */
export function applicantDiscordId(stored: string): string | null {
  return stored ? stored : null;
}
