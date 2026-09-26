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

/** WoW names: 2–12 letters, one capital. The rest is normalised the way the game does. */
export const NAME_PATTERN = /^[A-Za-zÀ-ÿ]{2,12}$/;

export function normaliseName(raw: string): string {
  const name = raw.trim();
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
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
  const raw = typeof b.name === 'string' ? b.name.trim() : '';
  if (!NAME_PATTERN.test(raw)) return { ok: false, error: 'Character names are 2 to 12 letters.' };
  const name = normaliseName(raw);

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
