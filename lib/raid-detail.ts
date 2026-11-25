/**
 * Raid detail (SYNC-SPEC §9.5): the roster grouped by role with Answer and Via columns,
 * the bench, the No response and Absent lists, and who can be marked attended. Pure, so the grouping
 * and the attendance defaults are unit-tested instead of improvised in the page.
 */
import { compositionRole, COMPOSITION_ROLES, type CompositionRole, type Role, type WowClass } from '@/lib/design/class-colors';
import type { RaidResponse, SignupSource } from '@/lib/raids';

export type Standing = 'ROSTER' | 'BENCH';

/** One Signup row as the detail page shows it. Roster members who have not answered have `response: null`. */
export type DetailRow = {
  userId: string;
  /** The member's Discord name: people are named by it, not by their main. */
  name: string;
  /** The main character's name, shown beside class and spec. Null until officers add a main. */
  character: string | null;
  wowClass: WowClass | null;
  spec: string | null;
  role: Role | null;
  standing: Standing;
  response: RaidResponse | null;
  attended: boolean | null;
  source: SignupSource;
  reason: string | null;
  /** The officer who answered on the member's behalf, if any. */
  setBy: string | null;
  updatedAt: string;
};

export type RoleGroupKey = CompositionRole | 'none';
export type RoleGroup = { role: RoleGroupKey; rows: DetailRow[] };

/** Accepted first, then tentative, unanswered, absent; alphabetical inside each. */
const ANSWER_ORDER: Record<string, number> = { accept: 0, tentative: 1, null: 2, absent: 3 };

export function compareRows(a: DetailRow, b: DetailRow): number {
  const byAnswer = ANSWER_ORDER[String(a.response)] - ANSWER_ORDER[String(b.response)];
  return byAnswer !== 0 ? byAnswer : a.name.localeCompare(b.name);
}

/**
 * Signed-up roster rows (Accept or Tentative) by the role of the character each brings (melee and
 * ranged together as DPS) in raid order. Tank, Healer and DPS always appear, even empty, so the page
 * can say nobody has signed up; answered members without a character land last under `none`, which
 * appears only when someone is in it.
 */
export function groupByRole(rows: DetailRow[]): RoleGroup[] {
  const groups: RoleGroup[] = [...COMPOSITION_ROLES, 'none' as const].map((role) => ({ role, rows: [] }));
  for (const row of rows) {
    if (row.response !== 'accept' && row.response !== 'tentative') continue;
    groups.find((g) => g.role === (row.role ? compositionRole(row.role) : 'none'))!.rows.push(row);
  }
  for (const g of groups) g.rows.sort(compareRows);
  return groups.filter((g) => g.role !== 'none' || g.rows.length > 0);
}

export type Split = { roster: DetailRow[]; bench: DetailRow[]; noResponse: DetailRow[]; absent: DetailRow[] };

const byName = (a: DetailRow, b: DetailRow) => a.name.localeCompare(b.name);

/** Roster rows, bench rows, and the roster rows with no answer or an Absent answer (the two lists under the role groups). */
export function splitStanding(rows: DetailRow[]): Split {
  const roster = rows.filter((r) => r.standing === 'ROSTER');
  return {
    roster,
    bench: rows.filter((r) => r.standing === 'BENCH').sort(compareRows),
    noResponse: roster.filter((r) => r.response === null).sort(byName),
    absent: roster.filter((r) => r.response === 'absent').sort(byName),
  };
}

/**
 * Who the attendance form lists: everyone who accepted or was tentative, roster or bench.
 * Ticked by default when they accepted, unless an officer already recorded otherwise.
 */
export function attendanceCandidates(rows: DetailRow[]): { row: DetailRow; checked: boolean }[] {
  return rows
    .filter((r) => r.response === 'accept' || r.response === 'tentative')
    .sort(compareRows)
    .map((row) => ({ row, checked: row.attended ?? row.response === 'accept' }));
}

/** The raid takes no new answers from members: locked, finished or cancelled. */
export function signupsClosed(raid: { status?: 'SCHEDULED' | 'LOCKED' | 'DONE' | 'CANCELLED'; locksAt?: string; cancelled: boolean }, past: boolean, now: Date): boolean {
  if (past || raid.cancelled || raid.status === 'DONE' || raid.status === 'CANCELLED' || raid.status === 'LOCKED') return true;
  return raid.locksAt !== undefined && Date.parse(raid.locksAt) <= now.getTime();
}
