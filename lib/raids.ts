/**
 * Raid calendar logic (docs/04 § Raid calendar, § Sign-up confirmation). Pure: the page
 * and the sign-up hook lean on these so the optimistic update and the toast copy are
 * unit-tested rather than improvised in components.
 */
import type { Role } from '@/lib/design/class-colors';
import { GUILD_TIMEZONE } from '@/lib/config';
import { formatClock, zonedParts } from '@/lib/time';

export type RaidResponse = 'accept' | 'tentative' | 'absent';
export const RESPONSES: readonly RaidResponse[] = ['accept', 'tentative', 'absent'];

export type RoleCounts = Record<Role, number>;
export const ZERO_COUNTS: RoleCounts = { tank: 0, healer: 0, melee: 0, ranged: 0 };

/** One raid as the calendar card needs it. Instants are ISO strings so it crosses the server boundary. */
export type RaidCard = {
  id: string;
  name: string;
  startsAt: string;
  durationMin: number;
  notes: string | null;
  cancelled: boolean;
  requirements: RoleCounts;
  /** Accepted sign-ups per role. */
  counts: RoleCounts;
  /** The viewer's own response, if any. */
  mine: RaidResponse | null;
};

export function isRaidResponse(value: unknown): value is RaidResponse {
  return typeof value === 'string' && (RESPONSES as readonly string[]).includes(value);
}

/** Requirements come from a JSON column; anything malformed reads as zero rather than throwing. */
export function parseRequirements(value: unknown): RoleCounts {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const n = (k: Role) => (typeof v[k] === 'number' && Number.isFinite(v[k]) && (v[k] as number) >= 0 ? Math.floor(v[k] as number) : 0);
  return { tank: n('tank'), healer: n('healer'), melee: n('melee'), ranged: n('ranged') };
}

/** Accepted sign-ups per role. Members without a main have no role and are not counted. */
export function countAccepted(signups: { response: RaidResponse; role: Role | null }[]): RoleCounts {
  const counts = { ...ZERO_COUNTS };
  for (const s of signups) if (s.response === 'accept' && s.role) counts[s.role] += 1;
  return counts;
}

/** The counts after the viewer changes their own answer, for the optimistic row. */
export function applyResponse(counts: RoleCounts, role: Role | null, from: RaidResponse | null, to: RaidResponse | null): RoleCounts {
  if (!role || from === to) return counts;
  const next = { ...counts };
  if (from === 'accept') next[role] = Math.max(0, next[role] - 1);
  if (to === 'accept') next[role] += 1;
  return next;
}

/** warn below the requirement, stop at zero, ok otherwise (docs/04 § Raid calendar § Rows). */
export function countTone(count: number, required: number): 'ok' | 'warn' | 'stop' {
  if (count <= 0 && required > 0) return 'stop';
  if (count < required) return 'warn';
  return 'ok';
}

/** Past raids shown on the calendar: the last eight weeks. Older history is a report, not a calendar. */
export const PAST_WINDOW_MS = 8 * 7 * 24 * 3600_000;

export function pastWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - PAST_WINDOW_MS);
}

/** Upcoming means not yet finished: a raid in progress stays on the upcoming list. */
export function isUpcoming(raid: { startsAt: string; durationMin: number }, now: Date): boolean {
  return Date.parse(raid.startsAt) + raid.durationMin * 60_000 >= now.getTime();
}

/** Same calendar day as `now` in the viewer's zone. */
export function isTonight(startsAt: string, now: Date, zone: string): boolean {
  const a = zonedParts(new Date(startsAt), zone);
  const b = zonedParts(now, zone);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Wednesday", in guild time, as the raid is announced. */
export function raidWeekday(startsAt: string): string {
  return WEEKDAY_LONG[zonedParts(new Date(startsAt), GUILD_TIMEZONE).weekday];
}

/**
 * Toast copy for a response (docs/04 § Sign-up confirmation): "You're in for Wednesday —
 * Blackwing Lair" with the dual time beneath. Clearing an answer reads as withdrawn.
 */
export function responseToast(raid: { name: string; startsAt: string }, response: RaidResponse | null, viewerZone: string | null): { title: string; detail: string } {
  const day = raidWeekday(raid.startsAt);
  const title =
    response === 'accept'
      ? `You're in for ${day} — ${raid.name}`
      : response === 'tentative'
        ? `Marked tentative for ${day} — ${raid.name}`
        : response === 'absent'
          ? `Marked absent for ${day} — ${raid.name}`
          : `Answer withdrawn for ${day} — ${raid.name}`;
  const start = new Date(raid.startsAt);
  const guild = `${formatClock(start, GUILD_TIMEZONE)} guild`;
  const detail = viewerZone && viewerZone !== GUILD_TIMEZONE ? `${guild} · ${formatClock(start, viewerZone)} your time` : guild;
  return { title, detail };
}
