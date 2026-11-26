import { expect, it } from 'vitest';
import { isUnderRaidLevel, levelText, raidRowMeta } from './roster-level';

it('flags only a known level under 60', () => {
  expect(isUnderRaidLevel(52)).toBe(true);
  expect(isUnderRaidLevel(59)).toBe(true);
  expect(isUnderRaidLevel(60)).toBe(false);
  expect(isUnderRaidLevel(null)).toBe(false);
});
it('reads a level, or says it is unknown', () => {
  expect(levelText(52)).toBe('Level 52');
  expect(levelText(null)).toBe('Level unknown');
});

it('a raid page row shows a level only when known and under 60', () => {
  expect(raidRowMeta(['Grimbo Ash', 'Warrior', null], 52)).toBe('Grimbo Ash · Warrior · Level 52');
  expect(raidRowMeta(['Grimbo Ash', 'Warrior'], 60)).toBe('Grimbo Ash · Warrior');
  expect(raidRowMeta(['Grimbo Ash', 'Warrior'], null)).toBe('Grimbo Ash · Warrior');
});
