/**
 * Officer heatmap aggregation (docs/05 § Officer view). Every member paints a recurring
 * week in their own zone; here those weeks are projected onto one grid in the requesting
 * officer's zone and stacked. "If needed" counts as half. Pure: the API route feeds it rows
 * and the client never sees a raw week.
 */
import { DAYS, mondayIndex, SLOTS, weekStart, type SlotState, type Week } from '@/lib/availability';
import type { WowClass } from '@/lib/design/class-colors';
import { zonedParts, zonedTimeToUtc } from '@/lib/time';

export type HeatRole = 'tank' | 'healer' | 'melee' | 'ranged';
export const HEAT_ROLES: readonly HeatRole[] = ['tank', 'healer', 'melee', 'ranged'];
export type RoleCounts = Record<HeatRole, number>;

/** One roster member as the aggregation needs them. `slots` is null when they never saved. */
export type HeatMember = {
  name: string;
  /** null when the member has no main character on the roster yet. */
  wowClass: WowClass | null;
  role: HeatRole;
  timezone: string;
  slots: Week | null;
};

export type HeatCell = {
  /** available + half of if-needed, rounded half up. The number the ramp and windows use. */
  total: number;
  available: number;
  ifNeeded: number;
  /** Weighted the same way as `total`. */
  roles: RoleCounts;
  /** Indices into `Heatmap.members`, available first, then if-needed. */
  who: { i: number; state: SlotState }[];
};

export type HeatmapMember = { name: string; wowClass: WowClass | null; role: HeatRole };

export type Heatmap = {
  timezone: string;
  /** Monday 00:00 of the current week in `timezone`, ISO. */
  weekStart: string;
  memberCount: number;
  submitted: number;
  members: HeatmapMember[];
  /** `cells[day][slot]`, day 0 = Monday. */
  cells: HeatCell[][];
};

export const ZERO_ROLES: RoleCounts = { tank: 0, healer: 0, melee: 0, ranged: 0 };

/** Half weight for if-needed, rounded half up so 20 + 8 if-needed reads 24 and 1 if-needed reads 1. */
export function weighted(available: number, ifNeeded: number): number {
  return Math.round(available + ifNeeded / 2);
}

function emptyCell(): HeatCell {
  return { total: 0, available: 0, ifNeeded: 0, roles: { ...ZERO_ROLES }, who: [] };
}

/** Monday 00:00 of the member's current week, as calendar parts in their zone. */
function memberMonday(zone: string, now: Date): { year: number; month: number; day: number } {
  const p = zonedParts(weekStart(now, zone), zone);
  return { year: p.year, month: p.month, day: p.day };
}

/** The instant a member's painted (day, slot) falls on this week, in their own zone. */
export function slotInstant(monday: { year: number; month: number; day: number }, day: number, slot: number, zone: string): Date {
  const cal = new Date(Date.UTC(monday.year, monday.month - 1, monday.day + day));
  return zonedTimeToUtc(cal.getUTCFullYear(), cal.getUTCMonth() + 1, cal.getUTCDate(), Math.floor(slot / 2), (slot % 2) * 30, zone);
}

/**
 * Where an instant lands on the viewer's grid. The weekday wraps: a Sunday-night slot in
 * Kolkata is Sunday afternoon in Los Angeles, and a Monday-morning one is the viewer's
 * Sunday evening, which is the right column for a recurring week. Quarter-hour zones round
 * down to the half-hour that contains them.
 */
export function viewerCell(instant: Date, viewerZone: string): { day: number; slot: number } {
  const p = zonedParts(instant, viewerZone);
  return { day: mondayIndex(p.weekday), slot: p.hour * 2 + (p.minute >= 30 ? 1 : 0) };
}

export function buildHeatmap(members: HeatMember[], viewerZone: string, now: Date = new Date()): Heatmap {
  const cells: HeatCell[][] = Array.from({ length: DAYS }, () => Array.from({ length: SLOTS }, emptyCell));
  // Track available/if-needed per role separately so role totals round the same way as `total`.
  const roleSplit: { a: RoleCounts; n: RoleCounts }[][] = cells.map((row) => row.map(() => ({ a: { ...ZERO_ROLES }, n: { ...ZERO_ROLES } })));

  let submitted = 0;
  members.forEach((m, i) => {
    if (!m.slots) return;
    submitted += 1;
    const monday = memberMonday(m.timezone, now);
    for (const [key, state] of Object.entries(m.slots)) {
      const [d, s] = key.split(':').map(Number);
      if (!Number.isInteger(d) || !Number.isInteger(s) || d < 0 || d >= DAYS || s < 0 || s >= SLOTS) continue;
      const { day, slot } = viewerCell(slotInstant(monday, d, s, m.timezone), viewerZone);
      const cell = cells[day][slot];
      const split = roleSplit[day][slot];
      if (state === 'available') {
        cell.available += 1;
        split.a[m.role] += 1;
      } else {
        cell.ifNeeded += 1;
        split.n[m.role] += 1;
      }
      cell.who.push({ i, state });
    }
  });

  for (let d = 0; d < DAYS; d++) {
    for (let s = 0; s < SLOTS; s++) {
      const cell = cells[d][s];
      const split = roleSplit[d][s];
      cell.total = weighted(cell.available, cell.ifNeeded);
      for (const r of HEAT_ROLES) cell.roles[r] = weighted(split.a[r], split.n[r]);
      cell.who.sort((x, y) => (x.state === y.state ? x.i - y.i : x.state === 'available' ? -1 : 1));
    }
  }

  return {
    timezone: viewerZone,
    weekStart: weekStart(now, viewerZone).toISOString(),
    memberCount: members.length,
    submitted,
    members: members.map(({ name, wowClass, role }) => ({ name, wowClass, role })),
    cells,
  };
}

/** Which step of the six-step ramp a count falls on (docs/05 § Heatmap). */
export function heatStep(total: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (total <= 0) return 0;
  if (total <= 8) return 1;
  if (total <= 16) return 2;
  if (total <= 24) return 3;
  if (total <= 32) return 4;
  return 5;
}
