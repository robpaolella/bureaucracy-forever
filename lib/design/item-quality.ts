/**
 * WoW item quality colors, borrowed for the loot pages only (Robert's exception to
 * design-handover rule 1, 2026-09-29). Same shape as class-colors: `canonical` is the
 * in-game value, `onInk` is what the web uses. Rare and Epic fall below 4.5:1 on the
 * popover surface (--ink-800) at their canonical values, so they are lifted.
 *
 * Text only — item names and tooltip lines. Every use also carries the quality word for
 * screen readers, so the color is never the only signal.
 */
export type ItemQuality = { label: string; canonical: string; onInk: string };

export const ITEM_QUALITIES: readonly ItemQuality[] = [
  { label: 'Poor', canonical: '#9D9D9D', onInk: '#9D9D9D' },
  { label: 'Common', canonical: '#FFFFFF', onInk: '#F2F2F2' },
  { label: 'Uncommon', canonical: '#1EFF00', onInk: '#1EFF00' },
  { label: 'Rare', canonical: '#0070DD', onInk: '#3A9BE8' },
  { label: 'Epic', canonical: '#A335EE', onInk: '#B866F5' },
  { label: 'Legendary', canonical: '#FF8000', onInk: '#FF8000' },
  { label: 'Artifact', canonical: '#E6CC80', onInk: '#E6CC80' },
  { label: 'Heirloom', canonical: '#00CCFF', onInk: '#00CCFF' },
];

/** The quality for Wowhead's 0–7 number; anything unknown reads as Common. */
export function itemQuality(quality: number): ItemQuality {
  return ITEM_QUALITIES[quality] ?? ITEM_QUALITIES[1];
}

/** Wowhead tooltip colors that are not a quality: the gold "q" lines and money suffixes. */
export const TOOLTIP_COLORS = { yellow: '#FFD100', gold: '#FFD100', silver: '#C7C7CF', copper: '#EDA55F' } as const;

/**
 * CSS variables for the tooltip rules in app/globals.css, set inline on the tooltip so the
 * hex values live only here (and the contrast test covers them).
 */
export function tooltipColorVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  ITEM_QUALITIES.forEach((q, i) => (vars[`--wh-q${i}`] = q.onInk));
  for (const [k, v] of Object.entries(TOOLTIP_COLORS)) vars[`--wh-${k}`] = v;
  return vars;
}
