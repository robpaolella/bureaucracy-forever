/**
 * Officer roster editing (roadmap Phase 4): validation for a member's main character.
 * Pure, so the route and the form agree on what a character may be. Discord roles stay
 * the source for `Role`; the site owns the character, its spec, raid role and rank.
 */
import type { Rank } from '@/components/ui/Badges';
import { CLASSES, SPECS, type Role, type WowClass } from '@/lib/design/class-colors';

export const RANKS: readonly Rank[] = ['officer', 'raider', 'trial', 'social'];
export const RANK_LABEL: Record<Rank, string> = { officer: 'Officer', raider: 'Raider', trial: 'Trial', social: 'Social' };

export type CharacterInput = {
  name: string;
  wowClass: WowClass;
  spec: string;
  role: Role;
  rank: Rank;
};

export type ParsedCharacter = { ok: true; value: CharacterInput } | { ok: false; error: string };

/**
 * WoW Forever names are two parts, a first and a second name, each 2–12 letters, shown as
 * "First Second". One part alone is still accepted for characters named before the second
 * name existed. Each part is normalised the way the game does: one capital, the rest lower.
 * (× and ÷ sit inside the Latin-1 letter block and are skipped.)
 */
export const NAME_PART = /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,12}$/;
export const NAME_PATTERN = /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,12}( [A-Za-zÀ-ÖØ-öø-ÿ]{2,12})?$/;
export const NAME_ERROR = 'Character names are a first and a second name, 2 to 12 letters each.';

export function normaliseName(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** "First Second" from the two parts; the second may be empty. Null when either part is not a name. */
export function fullName(first: string, second: string): string | null {
  const a = first.trim();
  const b = second.trim();
  if (!NAME_PART.test(a) || (b && !NAME_PART.test(b))) return null;
  return normaliseName(b ? `${a} ${b}` : a);
}

/** The two parts of a stored name, for the form. */
export function splitName(name: string): { first: string; second: string } {
  const [first = '', second = ''] = name.trim().split(/\s+/);
  return { first, second };
}

export function specsFor(wowClass: WowClass): string[] {
  return SPECS[wowClass].map((s) => s.name);
}

/** The raid roles a spec can fill; Feral druids may tank or melee. */
export function rolesFor(wowClass: WowClass, spec: string): Role[] {
  return SPECS[wowClass].find((s) => s.name === spec)?.roles ?? [];
}

export function parseCharacterInput(body: unknown): ParsedCharacter {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  // Either the joined name or the two parts; the parts win when both are sent.
  const joined = typeof b.firstName === 'string' ? fullName(b.firstName, typeof b.secondName === 'string' ? b.secondName : '') : typeof b.name === 'string' && NAME_PATTERN.test(b.name.trim()) ? normaliseName(b.name) : null;
  if (!joined) return { ok: false, error: NAME_ERROR };
  const name = joined;

  const wowClass = b.wowClass;
  if (typeof wowClass !== 'string' || !(CLASSES as readonly string[]).includes(wowClass)) return { ok: false, error: 'Pick a class.' };
  const cls = wowClass as WowClass;

  const spec = typeof b.spec === 'string' ? b.spec : '';
  if (!specsFor(cls).includes(spec)) return { ok: false, error: 'Pick a spec for that class.' };

  const role = typeof b.role === 'string' ? b.role : '';
  const roles = rolesFor(cls, spec);
  if (!(roles as string[]).includes(role)) return { ok: false, error: 'Pick a raid role that spec can fill.' };

  const rank = typeof b.rank === 'string' ? b.rank : '';
  if (!(RANKS as readonly string[]).includes(rank)) return { ok: false, error: 'Pick a rank.' };

  return { ok: true, value: { name, wowClass: cls, spec, role: role as Role, rank: rank as Rank } };
}

/** A blank form for a new main. */
export function emptyCharacter(): CharacterInput {
  return { name: '', wowClass: 'warrior', spec: 'Protection', role: 'tank', rank: 'trial' };
}

/** Keep spec and role valid as the class or spec changes, preferring what was chosen. */
export function reconcileCharacter(input: CharacterInput): CharacterInput {
  const specs = specsFor(input.wowClass);
  const spec = specs.includes(input.spec) ? input.spec : specs[0];
  const roles = rolesFor(input.wowClass, spec);
  const role = roles.includes(input.role) ? input.role : roles[0];
  return { ...input, spec, role };
}
