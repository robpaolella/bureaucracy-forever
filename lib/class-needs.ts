/**
 * Class needs (docs/04 § Recruitment: the needs table is the single source of truth for
 * the recruitment page, the home teaser and the bot's /recruiting reply). The database
 * holds one row per class and spec; these helpers turn that into the grouped rows the
 * pages draw and validate what officers may write.
 */
import type { ClassNeed, NeedStatus } from '@/content/recruitment';
import { CLASSES, SPECS, type Role, type WowClass } from '@/lib/design/class-colors';

/** `featured`: the one high-need spec an officer starred for the home page. */
export type NeedRow = { wowClass: WowClass; spec: string; status: NeedStatus; featured?: boolean };

export const NEED_STATUSES: readonly NeedStatus[] = ['high', 'medium', 'closed'];
const RANK: Record<NeedStatus, number> = { high: 0, medium: 1, closed: 2 };

export function isNeedStatus(value: unknown): value is NeedStatus {
  return typeof value === 'string' && (NEED_STATUSES as readonly string[]).includes(value);
}

export function isSpecOf(wowClass: WowClass, spec: string): boolean {
  return SPECS[wowClass].some((s) => s.name === spec);
}

/** Every class and spec in canonical order, with the stored status or closed. */
export function allSpecRows(stored: NeedRow[]): NeedRow[] {
  const byKey = new Map(stored.map((r) => [`${r.wowClass}/${r.spec}`, r]));
  return CLASSES.flatMap((wowClass) =>
    SPECS[wowClass].map((s) => {
      const row = byKey.get(`${wowClass}/${s.name}`);
      return { wowClass, spec: s.name, status: row?.status ?? 'closed', featured: row?.featured === true && row.status === 'high' };
    }),
  );
}

/**
 * The table rows: specs of one class sharing a status merge into one row with the union
 * of their roles. Classes with the most urgent need come first, then class order; within
 * a class, high before medium before closed.
 */
export function groupNeeds(rows: NeedRow[]): ClassNeed[] {
  const out: ClassNeed[] = [];
  for (const wowClass of CLASSES) {
    const mine = rows.filter((r) => r.wowClass === wowClass);
    if (mine.length === 0) continue;
    const byStatus = new Map<NeedStatus, ClassNeed>();
    for (const spec of SPECS[wowClass]) {
      const row = mine.find((r) => r.spec === spec.name);
      if (!row) continue;
      const group = byStatus.get(row.status) ?? { wowClass, specs: [], roles: [], status: row.status };
      group.specs.push(spec.name);
      for (const role of spec.roles) if (!group.roles.includes(role)) group.roles.push(role);
      byStatus.set(row.status, group);
    }
    out.push(...[...byStatus.values()].sort((a, b) => RANK[a.status] - RANK[b.status]));
  }
  const best = new Map<WowClass, number>();
  for (const g of out) best.set(g.wowClass, Math.min(best.get(g.wowClass) ?? 9, RANK[g.status]));
  const classIndex = (c: WowClass) => CLASSES.indexOf(c);
  return out.sort((a, b) => {
    const byBest = (best.get(a.wowClass) ?? 9) - (best.get(b.wowClass) ?? 9);
    if (byBest !== 0) return byBest;
    const byClass = classIndex(a.wowClass) - classIndex(b.wowClass);
    return byClass !== 0 ? byClass : RANK[a.status] - RANK[b.status];
  });
}

/** Roles a spec can fill, for the editor's read-only role column. */
export function rolesOfSpec(wowClass: WowClass, spec: string): Role[] {
  return SPECS[wowClass].find((s) => s.name === spec)?.roles ?? [];
}

export type ParsedFeature = { ok: true; value: { wowClass: WowClass; spec: string; featured: boolean } } | { ok: false; error: string };

/** Body of POST /api/class-needs/featured: `{ wowClass, spec, featured }`. */
export function parseFeatureInput(body: unknown): ParsedFeature {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const wowClass = b.wowClass;
  if (typeof wowClass !== 'string' || !(CLASSES as readonly string[]).includes(wowClass)) return { ok: false, error: 'Pick a class.' };
  const spec = typeof b.spec === 'string' ? b.spec : '';
  if (!isSpecOf(wowClass as WowClass, spec)) return { ok: false, error: 'Pick a spec for that class.' };
  if (typeof b.featured !== 'boolean') return { ok: false, error: 'Featured is true or false.' };
  return { ok: true, value: { wowClass: wowClass as WowClass, spec, featured: b.featured } };
}

export type ParsedNeed = { ok: true; value: NeedRow } | { ok: false; error: string };

export function parseNeedInput(body: unknown): ParsedNeed {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const wowClass = b.wowClass;
  if (typeof wowClass !== 'string' || !(CLASSES as readonly string[]).includes(wowClass)) return { ok: false, error: 'Pick a class.' };
  const spec = typeof b.spec === 'string' ? b.spec : '';
  if (!isSpecOf(wowClass as WowClass, spec)) return { ok: false, error: 'Pick a spec for that class.' };
  if (!isNeedStatus(b.status)) return { ok: false, error: 'Status is high, medium or closed.' };
  return { ok: true, value: { wowClass: wowClass as WowClass, spec, status: b.status } };
}
