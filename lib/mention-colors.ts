/** The panel the notes and messages sit on: `ink-800` in DESIGN.md. */
export const SURFACE = 0x141922;
export const MIN_CONTRAST = 4.5;
/** How much of the role colour tints the pill background. */
const TINT = 0.16;

type Rgb = [number, number, number];
const rgb = (n: number): Rgb => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i] - v) * t) as Rgb;
const hex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

function luminance(c: Rgb): number {
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text and background for a pill in a Discord role colour, or null for colour 0 (no colour: the caller
 * uses the accent style). The background is a faint tint of the colour over the surface. The text is the
 * role colour, lightened until it reaches 4.5:1 on that background. The surface is dark, so a colour is
 * never darkened: pale colours already pass and white always does.
 */
export function roleColors(color: number, surface: number = SURFACE): { text: string; background: string } | null {
  if (!Number.isInteger(color) || color <= 0 || color > 0xffffff) return null;
  const base = rgb(color);
  const background = mix(rgb(surface), base, TINT);
  let text = base;
  for (let t = 0; t <= 1 && contrast(text, background) < MIN_CONTRAST; t += 0.05) text = mix(base, [255, 255, 255], t);
  return { text: hex(text), background: hex(background) };
}
