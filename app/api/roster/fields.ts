import type { CharacterInput } from '@/lib/roster-edit';

/** Form values to the Prisma enums (upper-case) the Character row stores. */
export function toPrismaCharacter(v: CharacterInput) {
  return {
    name: v.name,
    class: v.wowClass.toUpperCase() as Uppercase<CharacterInput['wowClass']>,
    spec: v.spec,
    raidRole: v.role.toUpperCase() as Uppercase<CharacterInput['role']>,
    rank: v.rank.toUpperCase() as Uppercase<CharacterInput['rank']>,
  };
}
