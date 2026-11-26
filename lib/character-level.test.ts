import { describe, expect, it } from 'vitest';
import { freshLevel, LEVEL_MAX_AGE_MS } from './character-level';

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
