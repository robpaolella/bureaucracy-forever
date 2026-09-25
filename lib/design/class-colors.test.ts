import { describe, expect, it } from 'vitest';
import { CLASSES, CLASS_COLORS, SPECS } from './class-colors';

const INK_950 = '#06080B';

/** WCAG 2.x relative luminance of a #rrggbb color. */
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

describe('class colors', () => {
  it.each(CLASSES)('%s onInk meets 4.5:1 against the page background', (cls) => {
    expect(contrast(CLASS_COLORS[cls].onInk, INK_950)).toBeGreaterThanOrEqual(4.5);
  });

  // docs/01 says only shaman and warlock are lifted; the handover data also
  // nudges priest off pure white. Lock the data as shipped.
  it('changes onInk only for priest, shaman and warlock', () => {
    const lifted = CLASSES.filter((c) => CLASS_COLORS[c].onInk !== CLASS_COLORS[c].canonical);
    expect(lifted.sort()).toEqual(['priest', 'shaman', 'warlock']);
  });

  it('gives every class at least one spec', () => {
    for (const cls of CLASSES) expect(SPECS[cls].length).toBeGreaterThan(0);
  });
});
