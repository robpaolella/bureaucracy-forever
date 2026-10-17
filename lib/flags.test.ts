import { describe, expect, it } from 'vitest';
import { helperEnabled, lootEnabled } from './flags';

describe('lootEnabled', () => {
  it('is off when unset or empty', () => {
    expect(lootEnabled({})).toBe(false);
    expect(lootEnabled({ LOOT_ENABLED: '' })).toBe(false);
  });

  it.each(['true', 'TRUE', ' true ', '1'])('is on for %j', (value) => {
    expect(lootEnabled({ LOOT_ENABLED: value })).toBe(true);
  });

  it.each(['false', '0', 'yes', 'on'])('is off for %j', (value) => {
    expect(lootEnabled({ LOOT_ENABLED: value })).toBe(false);
  });
});

describe('helperEnabled', () => {
  it('reads ADDON_HELPER_ENABLED alone', () => {
    expect(helperEnabled({})).toBe(false);
    expect(helperEnabled({ LOOT_ENABLED: 'true' })).toBe(false);
    expect(helperEnabled({ ADDON_HELPER_ENABLED: 'true' })).toBe(true);
    expect(helperEnabled({ ADDON_HELPER_ENABLED: 'no' })).toBe(false);
  });
});
