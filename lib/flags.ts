/**
 * Feature flags from the environment. Server-side only (not NEXT_PUBLIC). A flag is on
 * only when set to `true` or `1`; unset, empty or anything else is off.
 */
function isOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

/** Loot features. Off unless LOOT_ENABLED is set; staging turns it on first. */
export function lootEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return isOn(env.LOOT_ENABLED);
}
