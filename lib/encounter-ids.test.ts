import { describe, expect, it } from 'vitest';

import { ENCOUNTER_ROWS, encounterId } from '@/lib/encounter-ids';

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
