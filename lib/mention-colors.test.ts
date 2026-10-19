import { describe, expect, it } from 'vitest';
import { contrast, MIN_CONTRAST, roleColors, SURFACE } from './mention-colors';

const parse = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

describe('roleColors', () => {
  it('uses no colour for 0 and for values that are not a Discord colour', () => {
    for (const c of [0, -1, 0x1000000, 1.5, NaN]) expect(roleColors(c)).toBeNull();
  });
  it.each([
    ['nearly black', 0x000001], ['white', 0xffffff], ['mid grey', 0x808080], ['Discord teal', 0x1abc9c], ['Discord green', 0x2ecc71],
    ['Discord blue', 0x3498db], ['Discord purple', 0x9b59b6], ['Discord magenta', 0xe91e63], ['Discord gold', 0xf1c40f],
    ['Discord orange', 0xe67e22], ['Discord red', 0xe74c3c], ['dark navy', 0x0000ff], ['dark blue', 0x206694], ['dark red', 0x992d22],
  ])('keeps %s readable on its tint (4.5:1)', (_n, color) => {
    const r = roleColors(color)!;
    expect(contrast(parse(r.text), parse(r.background))).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
  it('keeps a colour that already reads well', () => expect(roleColors(0xf1c40f)!.text).toBe('#f1c40f'));
  it('lightens a dark colour', () => expect(parse(roleColors(0x000001)!.text)[2]).toBeGreaterThan(100));
  it('keeps the background a faint tint close to the surface', () => {
    const bg = parse(roleColors(0xffffff)!.background);
    expect(contrast(bg, [(SURFACE >> 16) & 255, (SURFACE >> 8) & 255, SURFACE & 255])).toBeLessThan(2);
  });
});
