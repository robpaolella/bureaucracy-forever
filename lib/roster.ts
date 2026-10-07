/**
 * Roster table logic (docs/04 § Roster): filtering, sorting and grouping over the mains
 * on the roster. Pure, so the page's behaviour is unit-tested and the client component
 * stays a thin shell.
 */
import type { Rank } from '@/components/ui/Badges';
import type { Role, WowClass } from '@/lib/design/class-colors';
import { ROSTER_NO_MAIN } from '@/content/roster';

export type RosterAlt = { id: string; name: string; wowClass: WowClass; spec: string; role: Role };

export type RosterRow = {
  id: string;
  /** The member's Discord name: people are named by it, not by their main. */
  name: string;
  /** The main character's name. Null until the member has a main on the site. */
  character: string | null;
  /** Read-only characters beside a main; empty for members without one. */
  alts: RosterAlt[];
  /** Null until the member has a main on the site. */
  wowClass: WowClass | null;
  spec: string | null;
  role: Role | null;
  rank: Rank;
  /** 0–1, or null before the first raid is recorded. */
  attendance: number | null;
  /** ISO instant. */
  joinedAt: string;
};

export type RosterFilters = {
  search: string;
  classes: WowClass[];
  roles: Role[];
  rank: Rank | '';
};

export const EMPTY_FILTERS: RosterFilters = { search: '', classes: [], roles: [], rank: '' };

export type RosterSortKey = 'name' | 'rank' | 'attendance' | 'joinedAt';
export type SortDir = 'asc' | 'desc';
export type GroupBy = 'flat' | 'role' | 'class';

/** Display order, highest first. */
export const RANK_ORDER: Rank[] = ['officer', 'raider', 'trial', 'social'];
const ROLE_ORDER: Role[] = ['tank', 'healer', 'melee', 'ranged'];

export function countActiveFilters(f: RosterFilters): number {
  return (f.search.trim() ? 1 : 0) + (f.classes.length ? 1 : 0) + (f.roles.length ? 1 : 0) + (f.rank ? 1 : 0);
}

export function filterRoster(rows: RosterRow[], f: RosterFilters): RosterRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || (r.character?.toLowerCase().includes(q) ?? false) || r.alts.some((alt) => alt.name.toLowerCase().includes(q))) &&
      (f.classes.length === 0 || (r.wowClass !== null && f.classes.includes(r.wowClass))) &&
      (f.roles.length === 0 || (r.role !== null && f.roles.includes(r.role))) &&
      (!f.rank || r.rank === f.rank),
  );
}

const byName = (a: RosterRow, b: RosterRow) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

/**
 * Sort with the docs' default: rank descending (officers first), then name ascending. Any
 * other key falls back to name so equal values keep a stable, readable order. Unknown
 * attendance sorts last whichever way the column points.
 */
export function sortRoster(rows: RosterRow[], key: RosterSortKey, dir: SortDir): RosterRow[] {
  const sign = dir === 'asc' ? 1 : -1;
  const cmp = (a: RosterRow, b: RosterRow): number => {
    switch (key) {
      case 'name':
        return sign * byName(a, b);
      case 'rank':
        // "asc" for rank means highest rank first, which is what a reader expects at the top.
        return sign * (RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)) || byName(a, b);
      case 'attendance': {
        if (a.attendance === null && b.attendance === null) return byName(a, b);
        if (a.attendance === null) return 1;
        if (b.attendance === null) return -1;
        return sign * (a.attendance - b.attendance) || byName(a, b);
      }
      case 'joinedAt':
        return sign * (Date.parse(a.joinedAt) - Date.parse(b.joinedAt)) || byName(a, b);
    }
  };
  return [...rows].sort(cmp);
}

export type RosterGroup = { key: string; label: string; rows: RosterRow[] };

/** The group label for members who have no main yet, under by-role and by-class. */
export const NO_MAIN_GROUP = ROSTER_NO_MAIN;

/** Flat is one unnamed group; by role and by class follow the roster's canonical orders, skipping empty groups; members without a main come last. */
export function groupRoster(rows: RosterRow[], by: GroupBy, classLabel: (c: WowClass) => string, roleLabel: (r: Role) => string): RosterGroup[] {
  if (by === 'flat') return [{ key: 'all', label: '', rows }];
  const noMain = rows.filter((r) => r.wowClass === null);
  const tail = noMain.length ? [{ key: 'none', label: NO_MAIN_GROUP, rows: noMain }] : [];
  if (by === 'role') {
    return [...ROLE_ORDER.map((role) => ({ key: role, label: roleLabel(role), rows: rows.filter((r) => r.role === role) })).filter((g) => g.rows.length > 0), ...tail];
  }
  const classes = [...new Set(rows.map((r) => r.wowClass).filter((c): c is WowClass => c !== null))].sort((a, b) => classLabel(a).localeCompare(classLabel(b)));
  return [...classes.map((c) => ({ key: c, label: classLabel(c), rows: rows.filter((r) => r.wowClass === c) })), ...tail];
}

/** "94%", or an em dash before any raid has been recorded. */
export function formatAttendance(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}
