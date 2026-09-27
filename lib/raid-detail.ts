/**
 * Raid detail (SYNC-SPEC §9.5): the roster grouped by role with Answer and Via columns,
 * the bench, who has not answered, and who can be marked attended. Pure, so the grouping
 * and the attendance defaults are unit-tested instead of improvised in the page.
 */
import type { Role, WowClass } from '@/lib/design/class-colors';
import type { RaidResponse, SignupSource } from '@/lib/raids';

export type Standing = 'ROSTER' | 'BENCH';

/** One Signup row as the detail page shows it. Roster members who have not answered have `response: null`. */
export type DetailRow = {
  userId: string;
  name: string;
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

export const ROLE_ORDER: readonly Role[] = ['tank', 'healer', 'melee', 'ranged'];
export type RoleGroupKey = Role | 'none';
export type RoleGroup = { role: RoleGroupKey; rows: DetailRow[] };

/** Accepted first, then tentative, unanswered, absent; alphabetical inside each. */
const ANSWER_ORDER: Record<string, number> = { accept: 0, tentative: 1, null: 2, absent: 3 };

export function compareRows(a: DetailRow, b: DetailRow): number {
  const byAnswer = ANSWER_ORDER[String(a.response)] - ANSWER_ORDER[String(b.response)];
  return byAnswer !== 0 ? byAnswer : a.name.localeCompare(b.name);
}

/** Roster rows by main role in raid order; members without a main land last under `none`. Empty groups are dropped. */
export function groupByRole(rows: DetailRow[]): RoleGroup[] {
  const groups: RoleGroup[] = [...ROLE_ORDER, 'none' as const].map((role) => ({ role, rows: [] }));
  for (const row of rows) groups.find((g) => g.role === (row.role ?? 'none'))!.rows.push(row);
  for (const g of groups) g.rows.sort(compareRows);
  return groups.filter((g) => g.rows.length > 0);
}

export type Split = { roster: DetailRow[]; bench: DetailRow[]; unanswered: DetailRow[] };

/** Roster rows (answered or not), bench rows, and the roster rows still waiting on an answer. */
export function splitStanding(rows: DetailRow[]): Split {
  const roster = rows.filter((r) => r.standing === 'ROSTER');
  return {
    roster,
    bench: rows.filter((r) => r.standing === 'BENCH').sort(compareRows),
    unanswered: roster.filter((r) => r.response === null).sort((a, b) => a.name.localeCompare(b.name)),
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
