/**
 * Feature flags from the environment. Server-side only (not NEXT_PUBLIC). A flag is on
 * only when set to `true` or `1`; unset, empty or anything else is off.
 */
import { isProductionDeployment } from '@/lib/deploy-env';

function isOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

/** Loot features. Off unless LOOT_ENABLED is set; staging turns it on first. */
export function lootEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return isOn(env.LOOT_ENABLED);
}

/**
 * Keeps sign-ups and reserves open until each event starts, for the add-on's dungeon tests.
 * Off unless OPEN_UNTIL_START is set; staging turns it on. Always off on a production
 * deployment, so a mistaken setting there changes nothing.
 */
export function openUntilStart(env: Record<string, string | undefined> = process.env): boolean {
  return !isProductionDeployment(env) && isOn(env.OPEN_UNTIL_START);
}
