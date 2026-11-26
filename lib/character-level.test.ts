import { describe, expect, it } from 'vitest';
import { freshLevel, isRename, LEVEL_BOT_MAX_AGE_MS, LEVEL_MAX_AGE_MS, levelForBot } from './character-level';

const now = new Date('2026-11-25T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('freshLevel', () => {
  it('returns a level checked within 30 days', () => {
    expect(freshLevel({ level: 60, levelCheckedAt: ago(LEVEL_MAX_AGE_MS) }, now)).toBe(60);
  });

  it('reads a level over 30 days old as unknown', () => {
    expect(freshLevel({ level: 60, levelCheckedAt: ago(LEVEL_MAX_AGE_MS + 1) }, now)).toBeNull();
  });

  it('is unknown when never checked or not found', () => {
    expect(freshLevel({ level: null, levelCheckedAt: null }, now)).toBeNull();
    expect(freshLevel({ level: null, levelCheckedAt: now }, now)).toBeNull();
    expect(freshLevel({ level: 60, levelCheckedAt: null }, now)).toBeNull();
  });
});

describe('levelForBot', () => {
  it('flags only a known level under 60', () => {
    expect(levelForBot({ level: 59, levelCheckedAt: now }, now)).toEqual({ level: 59, underRaidLevel: true });
    expect(levelForBot({ level: 60, levelCheckedAt: now }, now)).toEqual({ level: 60, underRaidLevel: false });
    expect(levelForBot({ level: null, levelCheckedAt: now }, now)).toEqual({ level: null, underRaidLevel: false });
    expect(levelForBot({ level: 20, levelCheckedAt: ago(LEVEL_MAX_AGE_MS + 1) }, now)).toEqual({ level: null, underRaidLevel: false });
    expect(levelForBot({ level: 20, levelCheckedAt: ago(LEVEL_BOT_MAX_AGE_MS) }, now)).toEqual({ level: 20, underRaidLevel: true });
    expect(levelForBot({ level: 20, levelCheckedAt: ago(LEVEL_BOT_MAX_AGE_MS + 1) }, now)).toEqual({ level: null, underRaidLevel: false });
  });
});

describe('isRename', () => {
  it('ignores capitalisation, as Blizzard does', () => {
    expect(isRename('Sample Name', 'sample NAME')).toBe(false);
    expect(isRename('Sample Name', 'Sample Other')).toBe(true);
  });
});
