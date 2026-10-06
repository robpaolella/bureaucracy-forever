import { describe, expect, it } from 'vitest';
import { GUILD_TIMEZONE } from '@/lib/config';
import { LOOT_RESERVES } from './loot-admin';

describe('LOOT_RESERVES.raidDate', () => {
  // Wed, Oct 7 2026, 8:00 PM in Los Angeles (PDT, UTC−7).
  const raid = new Date('2026-10-08T03:00:00Z');

  it('gives the guild date in guild time', () => {
    expect(GUILD_TIMEZONE).toBe('America/Los_Angeles');
    expect(LOOT_RESERVES.raidDate(raid, GUILD_TIMEZONE)).toBe('Wed, Oct 7');
  });

  it('gives the next day where 8:00 PM guild time is past midnight', () => {
    expect(LOOT_RESERVES.raidDate(raid, 'Europe/London')).toBe('Thu, Oct 8');
    expect(LOOT_RESERVES.raidDate(raid, 'Australia/Sydney')).toBe('Thu, Oct 8');
  });

  it('gives the same date in a zone equal to guild time', () => {
    expect(LOOT_RESERVES.raidDate(raid, 'America/Vancouver')).toBe('Wed, Oct 7');
  });

  it('crosses a month end', () => {
    expect(LOOT_RESERVES.raidDate(new Date('2026-11-01T03:00:00Z'), 'Europe/London')).toBe('Sun, Nov 1');
    expect(LOOT_RESERVES.raidDate(new Date('2026-11-01T03:00:00Z'), GUILD_TIMEZONE)).toBe('Sat, Oct 31');
  });
});
