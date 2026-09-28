/**
 * Raid calendar logic (docs/04 § Raid calendar, § Sign-up confirmation). Pure: the page
 * and the sign-up hook lean on these so the optimistic update and the toast copy are
 * unit-tested rather than improvised in components.
 */
import type { Role, WowClass } from '@/lib/design/class-colors';
import { GUILD_TIMEZONE } from '@/lib/config';
import { formatClock, nextOccurrence, zonedParts, zonedTimeToUtc, type Weekday } from '@/lib/time';

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
  /** SYNC-SPEC additions; optional so older callers and tests still build cards. */
  status?: 'SCHEDULED' | 'LOCKED' | 'DONE' | 'CANCELLED';
  locksAt?: string;
  /** Template short name for calendar chips ("MC"); null for a raid made without a template. */
  short?: string | null;
  /** The viewer holds a roster row on this raid (answered or not). */
  onRoster?: boolean;
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

/** Accepted sign-ups per role. Members without a main have no role and are not counted; an unanswered row (null) counts nothing. */
export function countAccepted(signups: { response: RaidResponse | null; role: Role | null }[]): RoleCounts {
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

/** The viewer's optimistic answer and the counts that went with it, held apart from the server's card. */
export type LocalAnswer = Pick<RaidCard, 'mine' | 'counts'>;

/**
 * The server's cards with the viewer's local answers on top. A local answer is dropped
 * once the server's own card already carries it: that fetch reflects the write, so its
 * counts are at least as fresh as anything held locally (other members' answers included).
 */
export function mergeLocal(cards: RaidCard[], local: ReadonlyMap<string, LocalAnswer>): RaidCard[] {
  return cards.map((card) => {
    const mine = local.get(card.id);
    if (!mine || mine.mine === card.mine) return card;
    return { ...card, ...mine };
  });
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

export type SignupSource = 'web' | 'discord';

/** One sign-up as the raid detail lists it (docs/04 § Raid detail § Sign-up list). */
export type SignupRow = {
  userId: string;
  /** The member's Discord name. */
  name: string;
  wowClass: WowClass | null;
  spec: string | null;
  role: Role | null;
  response: RaidResponse;
  source: SignupSource;
  reason: string | null;
  /** The officer who answered on the member's behalf, if any. */
  setBy: string | null;
  updatedAt: string;
};

export type SignupSections = Record<RaidResponse, SignupRow[]>;

/** Accepted / Tentative / Absent, each newest answer first. */
export function groupSignups(rows: SignupRow[]): SignupSections {
  const sections: SignupSections = { accept: [], tentative: [], absent: [] };
  for (const row of rows) sections[row.response].push(row);
  for (const key of RESPONSES) sections[key].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return sections;
}

/** "12 via web · 9 via Discord": how the answers split by surface, all responses counted. */
export function sourceSplit(rows: { source: SignupSource }[]): { web: number; discord: number } {
  let web = 0;
  let discord = 0;
  for (const row of rows) if (row.source === 'discord') discord += 1; else web += 1;
  return { web, discord };
}

export function totalCounts(counts: RoleCounts): number {
  return counts.tank + counts.healer + counts.melee + counts.ranged;
}

/** What the schedule form submits: guild-time wall clock, never an instant. */
export type RaidInput = {
  name: string;
  /** YYYY-MM-DD in guild time. */
  date: string;
  /** HH:MM, 24-hour, in guild time. */
  time: string;
  durationMin: number;
  requirements: RoleCounts;
  notes: string;
};

export const RAID_NAME_MAX = 80;
export const RAID_NOTES_MAX = 500;
export const DURATIONS = [90, 120, 150, 180, 210, 240, 270, 300, 330, 360] as const;
export const DEFAULT_REQUIREMENTS: RoleCounts = { tank: 2, healer: 8, melee: 9, ranged: 11 };

/** SYNC-SPEC §3: sign-ups close this long before the start unless a series says otherwise. */
export const DEFAULT_LOCK_MINUTES = 120;

export function locksAtFor(startsAt: Date, lockMinutesBefore = DEFAULT_LOCK_MINUTES): Date {
  return new Date(startsAt.getTime() - lockMinutesBefore * 60_000);
}

export type ParsedRaid = { ok: true; value: RaidInput; startsAt: Date } | { ok: false; error: string };

/**
 * Validate a schedule / edit body. Every failure names the field so the form can show
 * it; the instant is derived here so the route and the form agree on guild time.
 */
export function parseRaidInput(body: unknown): ParsedRaid {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) return { ok: false, error: 'Give the raid a name.' };
  if (name.length > RAID_NAME_MAX) return { ok: false, error: `Keep the name under ${RAID_NAME_MAX} characters.` };

  const date = typeof b.date === 'string' ? b.date : '';
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const time = typeof b.time === 'string' ? b.time : '';
  const tm = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dm || !tm) return { ok: false, error: 'Pick a date and a start time.' };
  const [year, month, day] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [hour, minute] = [Number(tm[1]), Number(tm[2])];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return { ok: false, error: 'That date or time is not real.' };
  const startsAt = zonedTimeToUtc(year, month, day, hour, minute, GUILD_TIMEZONE);
  const back = zonedParts(startsAt, GUILD_TIMEZONE);
  // Also catches a wall time inside the spring-forward gap, which zonedTimeToUtc moves forward.
  if (back.month !== month || back.day !== day || back.hour !== hour || back.minute !== minute) {
    return { ok: false, error: 'That date or time is not real.' };
  }

  const durationMin = typeof b.durationMin === 'number' ? b.durationMin : Number(b.durationMin);
  if (!(DURATIONS as readonly number[]).includes(durationMin)) return { ok: false, error: 'Pick a raid length.' };

  const req = parseRequirements(b.requirements);
  const given = (b.requirements && typeof b.requirements === 'object' ? b.requirements : {}) as Record<string, unknown>;
  for (const role of ['tank', 'healer', 'melee', 'ranged'] as const) {
    const v = given[role];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 40) return { ok: false, error: 'Requirements are whole numbers from 0 to 40.' };
  }
  if (totalCounts(req) === 0) return { ok: false, error: 'A raid needs at least one person.' };

  const notes = typeof b.notes === 'string' ? b.notes.trim() : '';
  if (notes.length > RAID_NOTES_MAX) return { ok: false, error: `Keep the notes under ${RAID_NOTES_MAX} characters.` };

  return { ok: true, value: { name, date, time, durationMin, requirements: req, notes }, startsAt };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The form values for an existing raid, in guild time. */
export function raidToInput(raid: { name: string; startsAt: string; durationMin: number; requirements: RoleCounts; notes: string | null }): RaidInput {
  const p = zonedParts(new Date(raid.startsAt), GUILD_TIMEZONE);
  return {
    name: raid.name,
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
    durationMin: raid.durationMin,
    requirements: raid.requirements,
    notes: raid.notes ?? '',
  };
}

/**
 * A blank form, optionally prefilled from a heatmap window: `weekday` (0 = Sunday) and
 * `time` in guild time become the next such date; `length` is minutes.
 */
export function emptyRaidInput(prefill: { weekday?: Weekday; time?: string; length?: number } = {}, now: Date = new Date()): RaidInput {
  const time = prefill.time && /^\d{2}:\d{2}$/.test(prefill.time) ? prefill.time : '19:00';
  const at = prefill.weekday !== undefined ? nextOccurrence(prefill.weekday, time, GUILD_TIMEZONE, now) : now;
  const p = zonedParts(at, GUILD_TIMEZONE);
  const length = prefill.length && (DURATIONS as readonly number[]).includes(prefill.length) ? prefill.length : 180;
  return {
    name: '',
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time,
    durationMin: length,
    requirements: DEFAULT_REQUIREMENTS,
    notes: '',
  };
}
