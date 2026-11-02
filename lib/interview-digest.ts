import { GUILD_TIMEZONE } from '@/lib/config';
import { zonedParts, zonedTimeToUtc } from '@/lib/time';

/** The digest goes out on the first tick at or after this guild-time hour (SYNC-SPEC §6 step 15). */
export const DIGEST_HOUR = 8;

export type DigestWindow = {
  /** The guild date, `YYYY-MM-DD`. */
  date: string;
  /** That day's 08:00: no digest before it, and only interviews booked before it are listed. */
  cutoff: Date;
  /** The start of the next guild day: the listed interviews start before it. */
  dayEnd: Date;
};

/** The key of the `BotRequest` row that marks the date as handled. */
export const digestKey = (date: string) => `tick:interview-digest:${date}`;

/** `now`'s guild day with its 08:00 and end, computed in `GUILD_TIMEZONE` so DST days are right. Null before 08:00. */
export function digestWindow(now: Date): DigestWindow | null {
  const p = zonedParts(now, GUILD_TIMEZONE);
  const cutoff = zonedTimeToUtc(p.year, p.month, p.day, DIGEST_HOUR, 0, GUILD_TIMEZONE);
  if (now.getTime() < cutoff.getTime()) return null;
  // Date.UTC inside zonedTimeToUtc rolls day + 1 over month and year ends.
  const dayEnd = zonedTimeToUtc(p.year, p.month, p.day + 1, 0, 0, GUILD_TIMEZONE);
  const date = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  return { date, cutoff, dayEnd };
}

type DigestRow = {
  id: string;
  applicationId: string;
  bookedStart: Date | null;
  bookedById: string | null;
  application: { character: string; discordThreadId: string | null };
};

/** The `interview.digest` payload (SYNC-SPEC §5). `rows` arrive in start order; users are looked up by `bookedById`. */
export function digestPayload(date: string, rows: DigestRow[], users: { id: string; discordId: string; discordName: string }[]) {
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    date,
    interviews: rows.map((r) => {
      const booker = r.bookedById ? byId.get(r.bookedById) : undefined;
      return {
        interviewId: r.id,
        applicationId: r.applicationId,
        startsAt: r.bookedStart?.toISOString() ?? '',
        characterName: r.application.character,
        bookedBy: booker ? { discordId: booker.discordId, name: booker.discordName } : null,
        threadId: r.application.discordThreadId,
      };
    }),
  };
}
