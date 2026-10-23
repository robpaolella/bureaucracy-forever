// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { weekDays } from '@/lib/availability';
import { buildHeatmap, type Heatmap } from '@/lib/heatmap';
import { WindowFinder } from './WindowFinder';

const NOW = new Date('2026-09-30T12:00:00Z');
const LA = 'America/Los_Angeles';
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(heat: Heatmap) {
  await act(async () => root.render(<WindowFinder heat={heat} days={weekDays(NOW, LA)} offsetSlots={0} zone={LA} slotAt={() => '2026-09-29T19:00:00.000Z'} />));
}

/** 2 tanks, 8 healers, 10 melee and 10 ranged free on Tuesday 20:00–23:00. */
function fullRaid(): Heatmap {
  const slots = Object.fromEntries([40, 41, 42, 43, 44, 45].map((s) => [`1:${s}`, 'available' as const]));
  const make = (n: number, role: 'tank' | 'healer' | 'melee' | 'ranged') => Array.from({ length: n }, (_, i) => ({ name: `${role}${i}`, wowClass: null, role, timezone: LA, slots }));
  return buildHeatmap([...make(2, 'tank'), ...make(8, 'healer'), ...make(10, 'melee'), ...make(10, 'ranged')], LA, NOW);
}

describe('WindowFinder', () => {
  it('asks for tanks, healers and DPS, defaulting to 2, 8 and 20', async () => {
    await render(fullRaid());
    const labels = [...host.querySelectorAll('label')].map((l) => l.textContent);
    expect(labels).toEqual(['Min tanks', 'Min healers', 'Min DPS']);
    expect([...host.querySelectorAll('input')].map((i) => i.value)).toEqual(['2', '8', '20']);
  });

  it('shows a window with the three-role summary', async () => {
    await render(fullRaid());
    expect(host.textContent).toContain('2T · 8H · 20D');
    expect(host.textContent).not.toMatch(/\dM · |\dR\b/);
  });
});
