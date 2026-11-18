import { describe, expect, it } from 'vitest';
import { helperEnabled, lootEnabled, openUntilStart } from './flags';

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

describe('openUntilStart', () => {
  it('is off when unset, empty or not true/1', () => {
    expect(openUntilStart({})).toBe(false);
    expect(openUntilStart({ OPEN_UNTIL_START: '' })).toBe(false);
    expect(openUntilStart({ OPEN_UNTIL_START: 'yes' })).toBe(false);
  });

  it.each(['true', '1'])('is on locally and on staging for %j', (value) => {
    expect(openUntilStart({ OPEN_UNTIL_START: value })).toBe(true);
    expect(openUntilStart({ OPEN_UNTIL_START: value, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'staging' })).toBe(true);
  });

  it('is off on a production deployment whatever the value', () => {
    expect(openUntilStart({ OPEN_UNTIL_START: 'true', VERCEL_ENV: 'production' })).toBe(false);
  });
});
