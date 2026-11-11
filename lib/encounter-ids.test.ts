import { describe, expect, it } from 'vitest';

import { checkBossNames, ENCOUNTER_ROWS, encounterId } from '@/lib/encounter-ids';

describe('encounter id table', () => {
  it('holds positive integer ids, none repeated', () => {
    expect(ENCOUNTER_ROWS.length).toBeGreaterThan(100);
    for (const row of ENCOUNTER_ROWS) expect(Number.isInteger(row.id) && row.id > 0, `${row.map} ${row.name}`).toBe(true);
    expect(new Set(ENCOUNTER_ROWS.map((r) => r.id)).size).toBe(ENCOUNTER_ROWS.length);
  });

  it('pins the Hall of Thanes ids', () => {
    expect(encounterId(3065, 'Faldrim Anvilmar')).toBe(3493);
    expect(encounterId(3065, 'Plunder')).toBe(3494);
    expect(encounterId(3065, 'Infurnus')).toBe(3495);
    expect(encounterId(3065, 'Durgen Dirgehammer')).toBe(3496);
  });

  it('ignores case and spacing in the name', () => {
    expect(encounterId(3065, '  durgen   DIRGEHAMMER ')).toBe(3496);
  });

  it('gives nothing for an unknown boss, an unknown map, or no instance', () => {
    expect(encounterId(3065, 'Not A Boss')).toBeUndefined();
    expect(encounterId(999999, 'Plunder')).toBeUndefined();
    expect(encounterId(null, 'Plunder')).toBeUndefined();
    expect(encounterId(undefined, 'Plunder')).toBeUndefined();
    expect(encounterId(0, 'Plunder')).toBeUndefined();
  });
});

describe('checkBossNames', () => {
  const hall = [
    { name: 'Faldrim Anvilmar', isTrash: false }, { name: 'Plunder', isTrash: false },
    { name: 'Magmatus', isTrash: false }, { name: 'durgen  dirgehammer', isTrash: false },
    { name: 'Trash', isTrash: true },
  ];
  it('flags a name that is not the game’s and lists the game’s names no row matched', () => {
    expect(checkBossNames(3065, hall)).toEqual({ kind: 'checked', flagged: ['Magmatus'], unmatched: ['Infurnus'] });
  });
  it('flags a rare monster that is not an encounter, but never trash', () => {
    const rows = [...hall.slice(0, 2), { name: 'Infurnus', isTrash: false }, hall[3], { name: 'Sneed’s Shredder', isTrash: false }, { name: 'Trash mobs', isTrash: true }];
    expect(checkBossNames(3065, rows)).toEqual({ kind: 'checked', flagged: ['Sneed’s Shredder'], unmatched: [] });
  });
  it('counts a name the map has twice as matched, and still flags a name that is on no map row', () => {
    const rows = [{ name: 'grubbis', isTrash: false }, { name: 'Mekgineer Thermaplugg', isTrash: false }, { name: 'Made Up', isTrash: false }];
    expect(checkBossNames(90, rows)).toMatchObject({ kind: 'checked', flagged: ['Made Up'] });
  });
  it('checks nothing without an instance number or for one the list does not cover', () => {
    expect(checkBossNames(null, hall)).toEqual({ kind: 'unchecked', reason: 'no-instance' });
    expect(checkBossNames(undefined, hall)).toEqual({ kind: 'unchecked', reason: 'no-instance' });
    expect(checkBossNames(999999, hall)).toEqual({ kind: 'unchecked', reason: 'not-listed' });
  });
});
