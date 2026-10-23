// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HeatCell } from '@/lib/heatmap';
import { InspectorBody } from './Inspector';

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

it('breaks a cell down into tanks, healers and DPS', async () => {
  const cell: HeatCell = { total: 31, available: 31, ifNeeded: 0, roles: { tank: 3, healer: 8, dps: 20 }, who: [] };
  await act(async () => root.render(<InspectorBody startsAt="2026-09-29T19:00:00.000Z" zone="America/Los_Angeles" cell={cell} members={[]} memberCount={40} />));
  const rows = [...host.querySelectorAll('dl > div')].map((d) => d.textContent);
  expect(rows).toEqual(['Tanks3', 'Healers8', 'DPS20']);
});
