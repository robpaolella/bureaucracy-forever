import 'server-only';

import { after } from 'next/server';
import { db } from '@/lib/db';
import { armorySettings, createArmoryClient, type ArmoryClient } from '@/lib/armory';

/**
 * Looks up one character's level on Blizzard's API and stores it (#565). Callers (#569, #566)
 * may fire and forget: this never throws.
 *
 * - found: level and both times set. not-found: level cleared, both times set.
 * - failed (429, 5xx, timeout): the old level stays; only the attempt time is set.
 * - Writes only while the character still has the name it was looked up by, so a rename during
 *   the call can't take the old name's level; a character deleted meanwhile writes nothing.
 * - Without Blizzard keys nothing is called or written.
 */
/** `gone`: deleted or renamed during the call, so nothing was written. */
export type StoreOutcome = 'found' | 'not-found' | 'failed' | 'skipped' | 'gone';

// One client per process, so its token is reused until it expires.
let shared: ArmoryClient | null | undefined;

function sharedClient(): ArmoryClient | null {
  if (shared === undefined) {
    const settings = armorySettings();
    shared = settings ? createArmoryClient(settings) : null;
  }
  return shared;
}

export async function lookupAndStoreLevel(
  characterId: string,
  client: ArmoryClient | null = sharedClient(),
  now: () => Date = () => new Date(),
): Promise<StoreOutcome> {
  if (!client) return 'skipped';
  try {
    const character = await db.character.findUnique({ where: { id: characterId }, select: { name: true } });
    if (!character) return 'gone';
    const result = await client.lookupLevel(character.name);
    const at = now();
    const data =
      result.kind === 'found' ? { level: result.level, levelCheckedAt: at, levelAttemptedAt: at }
      : result.kind === 'not-found' ? { level: null, levelCheckedAt: at, levelAttemptedAt: at }
      : { levelAttemptedAt: at };
    // Case-blind like the lookup itself: a capitalisation edit is not a rename (lib/character-level.ts).
    const { count } = await db.character.updateMany({ where: { id: characterId, name: { equals: character.name, mode: 'insensitive' } }, data });
    return count === 0 ? 'gone' : result.kind;
  } catch {
    return 'failed';
  }
}

/**
 * Runs the lookup after the response (#569), so a save never waits for Blizzard and a failed
 * lookup never fails it. Outside a request (scripts, tests) `after` throws; the lookup then
 * runs unawaited instead, which is equally safe because it never rejects.
 */
export function queueLevelLookup(characterId: string): void {
  try {
    after(() => lookupAndStoreLevel(characterId));
  } catch {
    void lookupAndStoreLevel(characterId);
  }
}
