import type { ItemSource } from '@/lib/loot-rules';

export const FOREVER_ONLY = 'The live site only accepts WoW Forever items. Use a Forever item link or choose Forever.';
export const SOURCE_CONFLICT = 'This item number is already saved from a different game. It cannot be replaced or used as an item from the other game.';

/** Shared by every item writer; NODE_ENV also says production on staging builds. */
export function itemSourceError(source: ItemSource, env: Record<string, string | undefined> = process.env): string | null {
  return env.VERCEL_ENV === 'production' && source !== 'FOREVER' ? FOREVER_ONLY : null;
}
