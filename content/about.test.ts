import { describe, expect, it } from 'vitest';
import { ABOUT_DESCRIPTION, OFFICERS } from './about';

describe('OFFICERS', () => {
  it('lists Stafu last as a warrior officer, not the guild master', () => {
    expect(OFFICERS.at(-1)).toEqual({ name: 'Stafu', wowClass: 'warrior', title: 'Officer' });
    expect(OFFICERS.at(-1)).not.toHaveProperty('guildMaster');
  });
});

describe('ABOUT_DESCRIPTION', () => {
  it('has no time-bound recruiting line', () => {
    expect(ABOUT_DESCRIPTION).not.toMatch(/recruiting/i);
  });

  it('states its claims as full sentences', () => {
    expect(ABOUT_DESCRIPTION).not.toMatch(/#1/);
    expect(ABOUT_DESCRIPTION.split('. ').length).toBeGreaterThanOrEqual(2);
    expect(ABOUT_DESCRIPTION.endsWith('.')).toBe(true);
  });
});
