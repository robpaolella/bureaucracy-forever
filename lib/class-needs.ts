/**
 * Class needs (docs/04 § Recruitment: the needs table is the single source of truth for
 * the recruitment page, the home teaser and the bot's /recruitment command). The database
 * holds one row per class and need spec (see NEED_SPECS); these helpers turn that into the
 * grouped rows the pages draw and validate what officers may write.
 */
import type { ClassNeed, NeedStatus } from '@/content/recruitment';
import { CLASS_COLORS, CLASSES, ROLE_LABELS, ROLES, SPECS, type Role, type WowClass } from '@/lib/design/class-colors';

/**
 * `spec` is a need spec's name (see NEED_SPECS), e.g. 'Holy' or 'Feral Tank'.
 * `featured`: the one high-need spec an officer starred for the home page.
 */
export type NeedRow = { wowClass: WowClass; spec: string; status: NeedStatus; featured?: boolean };

/** One recruitable seat: `name` is what is stored and shown to the bot, `spec` the game spec. */
export type NeedSpec = { name: string; spec: string; roles: Role[] };

/**
 * What officers set a status on: every spec, with a spec that fills two raid roles split
 * into one per role (Feral: 'Feral Tank' and 'Feral Melee DPS'), so a guild short on bear
 * tanks can say so without also asking for cats.
 */
export const NEED_SPECS: Record<WowClass, NeedSpec[]> = Object.fromEntries(
  CLASSES.map((wowClass) => [
    wowClass,
    SPECS[wowClass].flatMap((s) =>
      s.roles.length === 1
        ? [{ name: s.name, spec: s.name, roles: [...s.roles] }]
        : s.roles.map((role) => ({ name: `${s.name} ${ROLE_LABELS[role]}`, spec: s.name, roles: [role] })),
    ),
  ]),
) as Record<WowClass, NeedSpec[]>;

/** The need spec called `name`, if the class has one. */
export function needSpec(wowClass: WowClass, name: string): NeedSpec | undefined {
  return NEED_SPECS[wowClass].find((s) => s.name === name);
}

export const NEED_STATUSES: readonly NeedStatus[] = ['high', 'medium', 'closed'];
const RANK: Record<NeedStatus, number> = { high: 0, medium: 1, closed: 2 };

export function isNeedStatus(value: unknown): value is NeedStatus {
  return typeof value === 'string' && (NEED_STATUSES as readonly string[]).includes(value);
}

export function isNeedSpecOf(wowClass: WowClass, name: string): boolean {
  return needSpec(wowClass, name) !== undefined;
}

/** Every class and need spec in canonical order, with the stored status or closed. */
export function allSpecRows(stored: NeedRow[]): NeedRow[] {
  const byKey = new Map(stored.map((r) => [`${r.wowClass}/${r.spec}`, r]));
  return CLASSES.flatMap((wowClass) =>
    NEED_SPECS[wowClass].map((s) => {
      const row = byKey.get(`${wowClass}/${s.name}`);
      return { wowClass, spec: s.name, status: row?.status ?? 'closed', featured: row?.featured === true && row.status === 'high' };
    }),
  );
}

/** `name` is the need spec, unique within the class; `spec` the game spec the card shows. */
export type HomeNeed = { wowClass: WowClass; label: string; name: string; spec: string; roles: Role[]; status: NeedStatus; featured: boolean };

/**
 * The home page strip: one card per class and need spec at high need, capped at `limit`.
 * The starred spec leads; the rest go tanks, healers, melee, ranged (the order raids
 * run short), then class and spec order. With nothing at high need it shows the medium
 * specs instead, so the strip is never empty while anything is open.
 */
export function homeNeeds(rows: NeedRow[], limit = 4): HomeNeed[] {
  const open = (status: NeedStatus) => rows.filter((r) => r.status === status);
  const pick = open('high').length > 0 ? open('high') : open('medium');
  const cards = pick.map((r) => ({
    wowClass: r.wowClass,
    label: CLASS_COLORS[r.wowClass].label,
    name: r.spec,
    spec: needSpec(r.wowClass, r.spec)?.spec ?? r.spec,
    roles: needRoles(r.wowClass, r.spec),
    status: r.status,
    featured: r.featured === true && r.status === 'high',
  }));
  const roleRank = (c: HomeNeed) => Math.min(...c.roles.map((role) => ROLES.indexOf(role)), ROLES.length);
  const specRank = (c: HomeNeed) => NEED_SPECS[c.wowClass].findIndex((s) => s.name === c.name);
  return cards
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        roleRank(a) - roleRank(b) ||
        CLASSES.indexOf(a.wowClass) - CLASSES.indexOf(b.wowClass) ||
        specRank(a) - specRank(b),
    )
    .slice(0, limit);
}

/**
 * The table rows: specs of one class sharing a status merge into one row with the union
 * of their roles. The halves of a split spec show as the game spec, once per row.
 * Classes with the most urgent need come first, then class order; within
 * a class, high before medium before closed.
 */
export function groupNeeds(rows: NeedRow[]): ClassNeed[] {
  const out: ClassNeed[] = [];
  for (const wowClass of CLASSES) {
    const mine = rows.filter((r) => r.wowClass === wowClass);
    if (mine.length === 0) continue;
    const byStatus = new Map<NeedStatus, ClassNeed>();
    for (const spec of NEED_SPECS[wowClass]) {
      const row = mine.find((r) => r.spec === spec.name);
      if (!row) continue;
      const group = byStatus.get(row.status) ?? { wowClass, specs: [], roles: [], status: row.status };
      if (!group.specs.includes(spec.spec)) group.specs.push(spec.spec);
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

/** Roles a game spec can fill (Feral: tank and melee). */
export function rolesOfSpec(wowClass: WowClass, spec: string): Role[] {
  return SPECS[wowClass].find((s) => s.name === spec)?.roles ?? [];
}

/** Roles a need spec recruits for (Feral Tank: tank), for the editor's read-only role column. */
export function needRoles(wowClass: WowClass, name: string): Role[] {
  return needSpec(wowClass, name)?.roles ?? [];
}

export type ParsedFeature = { ok: true; value: { wowClass: WowClass; spec: string; featured: boolean } } | { ok: false; error: string };

/** Body of PUT /api/class-needs/featured: `{ wowClass, spec, featured }`. */
export function parseFeatureInput(body: unknown): ParsedFeature {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const wowClass = b.wowClass;
  if (typeof wowClass !== 'string' || !(CLASSES as readonly string[]).includes(wowClass)) return { ok: false, error: 'Pick a class.' };
  const spec = typeof b.spec === 'string' ? b.spec : '';
  if (!isNeedSpecOf(wowClass as WowClass, spec)) return { ok: false, error: 'Pick a spec for that class.' };
  if (typeof b.featured !== 'boolean') return { ok: false, error: 'Featured is true or false.' };
  return { ok: true, value: { wowClass: wowClass as WowClass, spec, featured: b.featured } };
}

export type ParsedNeed = { ok: true; value: NeedRow } | { ok: false; error: string };

export function parseNeedInput(body: unknown): ParsedNeed {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const wowClass = b.wowClass;
  if (typeof wowClass !== 'string' || !(CLASSES as readonly string[]).includes(wowClass)) return { ok: false, error: 'Pick a class.' };
  const spec = typeof b.spec === 'string' ? b.spec : '';
  if (!isNeedSpecOf(wowClass as WowClass, spec)) return { ok: false, error: 'Pick a spec for that class.' };
  if (!isNeedStatus(b.status)) return { ok: false, error: 'Status is high, medium or closed.' };
  return { ok: true, value: { wowClass: wowClass as WowClass, spec, status: b.status } };
}

export type BotNeeds = {
  statuses: NeedStatus[];
  classes: { key: WowClass; label: string; specs: { name: string; status: NeedStatus }[] }[];
};

/**
 * GET /api/bot/needs (SYNC-SPEC §4, §9.8): every class in canonical order with every need
 * spec and its status, closed unless an officer set it, for the bot's /recruitment menus.
 */
export function needsForBot(stored: NeedRow[]): BotNeeds {
  const rows = allSpecRows(stored);
  return {
    statuses: [...NEED_STATUSES],
    classes: CLASSES.map((key) => ({
      key,
      label: CLASS_COLORS[key].label,
      specs: rows.filter((r) => r.wowClass === key).map((r) => ({ name: r.spec, status: r.status })),
    })),
  };
}
