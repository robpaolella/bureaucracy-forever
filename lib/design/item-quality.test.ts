import { describe, expect, it } from 'vitest';
import { ITEM_QUALITIES, itemQuality } from './item-quality';

/** The popover surface, the darkest place a quality color is not shown on. */
const INK_800 = '#141922';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('item quality colors', () => {
  it.each(ITEM_QUALITIES.map((q) => [q.label, q.onInk]))('%s onInk meets 4.5:1 on the popover surface', (_label, color) => {
    expect(contrast(color, INK_800)).toBeGreaterThanOrEqual(4.5);
  });

  it('maps Wowhead numbers and falls back to Common', () => {
    expect(itemQuality(4).label).toBe('Epic');
    expect(itemQuality(0).label).toBe('Poor');
    expect(itemQuality(42).label).toBe('Common');
    expect(itemQuality(-1).label).toBe('Common');
  });
});
