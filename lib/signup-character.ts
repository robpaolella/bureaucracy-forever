/** Select the fallback main, including the fields used by raid readers. */
export const MAIN_CHARACTER = { where: { isMain: true }, take: 1, select: { id: true, name: true, class: true, spec: true, raidRole: true } } as const;

/** A saved choice wins; legacy/deleted choices fall back to the member's current main. */
export function characterBrought<T>(signup: { character?: T | null; user: { characters: readonly T[] } }): T | null {
  return signup.character ?? signup.user.characters[0] ?? null;
}
