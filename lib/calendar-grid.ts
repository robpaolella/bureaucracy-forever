/**
 * Month grid for the calendar (SYNC-SPEC §9.4). Days are the viewer's calendar days, so a
 * raid at 8 PM Pacific sits on the right square for someone in London too.
 */
import type { RaidCard } from '@/lib/raids';
import { zonedParts } from '@/lib/time';

export type GridDay = { key: string; day: number; inMonth: boolean; today: boolean; raids: RaidCard[] };

export function monthLabel(year: number, month: number): string {
  return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1]} ${year}`;
}

/** Six rows of seven days starting Monday, covering `year`/`month` (1–12) in `zone`. */
export function monthCells(year: number, month: number, raids: RaidCard[], zone: string, now: Date): GridDay[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(year, month - 1, 1 - lead));
  const byDay = new Map<string, RaidCard[]>();
  for (const r of raids) {
    const p = zonedParts(new Date(r.startsAt), zone);
    const key = `${p.year}-${p.month}-${p.day}`;
    byDay.set(key, [...(byDay.get(key) ?? []), r]);
  }
  const t = zonedParts(now, zone);
  const todayKey = `${t.year}-${t.month}-${t.day}`;
  const rows: GridDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: GridDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getTime() + (w * 7 + d) * 86_400_000);
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
      row.push({ key, day: date.getUTCDate(), inMonth: date.getUTCMonth() + 1 === month, today: key === todayKey, raids: (byDay.get(key) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
    }
    rows.push(row);
    if (w >= 4 && rows[w].every((c) => !c.inMonth)) {
      rows.pop();
      break;
    }
  }
  return rows;
}

/** "Needs your answer" first: roster rows with no answer, then by start. */
export function sortNeedsAnswerFirst(raids: RaidCard[]): RaidCard[] {
  const needs = (r: RaidCard) => (r.onRoster && r.mine === null && r.status === 'SCHEDULED' ? 0 : 1);
  return [...raids].sort((a, b) => needs(a) - needs(b) || a.startsAt.localeCompare(b.startsAt));
}

export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + by, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
