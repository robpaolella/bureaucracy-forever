// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { weekDays } from '@/lib/availability';
import { buildHeatmap } from '@/lib/heatmap';
import { DaySummary } from './DaySummary';

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

/** Renders the week list, taps Monday to open its day and returns the day view's text. */
async function openDay(now: string, instant: string, zone: string, offsetSlots: number) {
  const days = weekDays(new Date(now), zone);
  const heat = buildHeatmap([], zone, new Date(now));
  await act(async () => root.render(<DaySummary heat={heat} days={days} offsetSlots={offsetSlots} zone={zone} slotAt={() => instant} />));
  await act(async () => host.querySelector<HTMLButtonElement>('ol button')!.click());
  return host.textContent ?? '';
}

describe('DaySummary zone note', () => {
  it('names PDT for an October day', async () => {
    expect(await openDay('2026-10-06T12:00:00Z', '2026-10-05T07:00:00.000Z', LA, 0)).toContain('Times are PDT.');
  });

  it('names PST for a December day', async () => {
    expect(await openDay('2026-12-08T12:00:00Z', '2026-12-07T08:00:00.000Z', LA, 0)).toContain('Times are PST.');
  });

  it('adds no note when the grid is not in guild time', async () => {
    expect(await openDay('2026-10-06T12:00:00Z', '2026-10-05T04:00:00.000Z', 'America/New_York', 2)).not.toContain('Times are');
  });
});
