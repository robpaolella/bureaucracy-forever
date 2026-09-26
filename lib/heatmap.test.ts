import { describe, expect, it } from 'vitest';
import { buildHeatmap, heatStep, slotInstant, viewerCell, weighted, type HeatMember } from './heatmap';

const LA = 'America/Los_Angeles';
const NOW = new Date('2026-09-30T12:00:00Z'); // Wed 30 Sep 2026, US and EU both on summer time

function member(name: string, timezone: string, slots: Record<string, 'available' | 'if-needed'> | null, role: HeatMember['role'] = 'melee'): HeatMember {
  return { name, wowClass: 'rogue', role, timezone, slots };
}

describe('weighted', () => {
  it('counts if-needed as half, rounding half up', () => {
    expect(weighted(20, 8)).toBe(24);
    expect(weighted(0, 1)).toBe(1);
    expect(weighted(2, 1)).toBe(3);
    expect(weighted(0, 0)).toBe(0);
  });
});

describe('projection', () => {
  it('keeps a Los Angeles member on the same cell for a Los Angeles officer', () => {
    const h = buildHeatmap([member('A', LA, { '1:40': 'available' })], LA, NOW);
    expect(h.cells[1][40].total).toBe(1);
    expect(h.cells[1][40].who).toEqual([{ i: 0, state: 'available' }]);
    expect(h.cells[1][39].total).toBe(0);
  });

  it('moves a Berlin member’s Wednesday 5 AM onto the officer’s Tuesday 8 PM', () => {
    const h = buildHeatmap([member('B', 'Europe/Berlin', { '2:10': 'available' })], LA, NOW);
    expect(h.cells[1][40].total).toBe(1);
  });

  it('wraps a Kolkata Monday morning onto the officer’s Sunday evening', () => {
    // Kolkata is 12h30 ahead of PDT: Monday 08:00 there is Sunday 19:30 in Los Angeles.
    const h = buildHeatmap([member('K', 'Asia/Kolkata', { '0:16': 'available' })], LA, NOW);
    expect(h.cells[6][39].total).toBe(1);
  });

  it('follows each zone through its own DST change', () => {
    // London leaves BST on 25 Oct 2026; Los Angeles leaves PDT on 1 Nov. In between the gap is 7h.
    const lon = member('L', 'Europe/London', { '2:40': 'available' }); // Wed 20:00 London
    expect(buildHeatmap([lon], LA, new Date('2026-10-21T12:00:00Z')).cells[2][24].total).toBe(1); // 8h gap → 12:00
    expect(buildHeatmap([lon], LA, new Date('2026-10-28T12:00:00Z')).cells[2][26].total).toBe(1); // 7h gap → 13:00
  });

  it('places a slot instant from the member’s own Monday', () => {
    const monday = { year: 2026, month: 9, day: 28 };
    expect(slotInstant(monday, 1, 40, LA).toISOString()).toBe('2026-09-30T03:00:00.000Z'); // Tue 20:00 PDT
    expect(viewerCell(new Date('2026-09-30T03:00:00.000Z'), 'America/Chicago')).toEqual({ day: 1, slot: 44 });
    expect(viewerCell(new Date('2026-09-30T03:00:00.000Z'), 'Asia/Kathmandu')).toEqual({ day: 2, slot: 17 }); // 08:45 rounds down to 08:30
  });
});

describe('stacking', () => {
  it('stacks members, splits roles and lists available before if-needed', () => {
    const h = buildHeatmap(
      [
        member('Tank', LA, { '1:40': 'available' }, 'tank'),
        member('Heal', LA, { '1:40': 'if-needed' }, 'healer'),
        member('Heal2', LA, { '1:40': 'if-needed' }, 'healer'),
        member('Melee', LA, { '1:40': 'available', '1:41': 'available' }, 'melee'),
        member('Absent', LA, null),
      ],
      LA,
      NOW,
    );
    const cell = h.cells[1][40];
    expect(cell.available).toBe(2);
    expect(cell.ifNeeded).toBe(2);
    expect(cell.total).toBe(3);
    expect(cell.roles).toEqual({ tank: 1, healer: 1, melee: 1, ranged: 0 });
    expect(cell.who.map((w) => w.i)).toEqual([0, 3, 1, 2]);
    expect(h.cells[1][41].total).toBe(1);
    expect(h.memberCount).toBe(5);
    expect(h.submitted).toBe(4);
    expect(h.members[0]).toEqual({ name: 'Tank', wowClass: 'rogue', role: 'tank' });
    expect(h.weekStart).toBe('2026-09-28T07:00:00.000Z');
  });

  it('keeps the role split summing to the total when if-needed halves round', () => {
    const h = buildHeatmap(
      [member('T', LA, { '1:40': 'if-needed' }, 'tank'), member('H', LA, { '1:40': 'if-needed' }, 'healer'), member('M', LA, { '1:40': 'available' }, 'melee')],
      LA,
      NOW,
    );
    const cell = h.cells[1][40];
    expect(cell.total).toBe(2); // 1 + 0.5 + 0.5
    const sum = cell.roles.tank + cell.roles.healer + cell.roles.melee + cell.roles.ranged;
    expect(sum).toBe(cell.total);
    expect(cell.roles.melee).toBe(1);
    expect(cell.roles.tank + cell.roles.healer).toBe(1); // one half rounds up, the other down
    expect(cell.roles.tank).toBe(1); // ties go to the earlier role
  });

  it('ignores malformed keys rather than throwing', () => {
    const h = buildHeatmap([member('X', LA, { '9:99': 'available', junk: 'available', '0:0': 'available' } as never)], LA, NOW);
    expect(h.cells[0][0].total).toBe(1);
    expect(h.cells.flat().reduce((n, c) => n + c.total, 0)).toBe(1);
  });
});

describe('heatStep', () => {
  it('follows the six-step ramp', () => {
    expect([0, 1, 8, 9, 16, 17, 24, 25, 32, 33, 41].map(heatStep)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});
