// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LoadHistory, type LoadView } from './LoadHistory';

const load = (n: number, over: Partial<LoadView> = {}): LoadView => ({
  sourceName: `file-${n}.json`, officerName: 'Redtape', createdAt: new Date(Date.UTC(2026, 8, 28, 4, 2) - n * 86_400_000).toISOString(), mode: 'merge', added: n, removed: 0, ...over,
});

let root: Root, host: HTMLDivElement;
beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const render = (loads: LoadView[]) => act(async () => root.render(<LoadHistory loads={loads} />));
const toggle = () => host.querySelector<HTMLButtonElement>('button[aria-controls]:not([aria-label])')!;

describe('LoadHistory', () => {
  it('shows neither the line nor the toggle on a never-loaded table', async () => {
    await render([]);
    expect(host.textContent).toBe('');
    expect(host.querySelector('button')).toBeNull();
  });

  it('names the latest load, its officer and its mode', async () => {
    await render([load(1, { mode: 'replace' }), load(2)]);
    const line = host.querySelector('span')!.textContent!;
    expect(line).toContain('Last loaded from file-1.json by Redtape');
    expect(line).toMatch(/· replace$/);
  });

  it('gives guild time on the time button for hover and focus', async () => {
    // A viewer outside guild time, so the time carries the guild-time popup.
    localStorage.setItem('bureaucracy.viewer-timezone', 'Asia/Tokyo');
    await render([load(1)]);
    const time = host.querySelector<HTMLButtonElement>('button[aria-label]')!;
    expect(time.getAttribute('aria-label')).toMatch(/GMT\+9.*guild time/);
    expect(host.querySelector('[role=tooltip]')!.textContent).toMatch(/guild time/);
    localStorage.removeItem('bureaucracy.viewer-timezone');
  });

  it('toggles the history and renames the toggle', async () => {
    await render([load(1)]);
    expect(toggle().textContent).toBe('Load history');
    expect(host.querySelector<HTMLElement>('#' + CSS.escape(toggle().getAttribute('aria-controls')!))!.hidden).toBe(true);
    await act(async () => toggle().click());
    expect(toggle().textContent).toBe('Hide load history');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector<HTMLElement>('#' + CSS.escape(toggle().getAttribute('aria-controls')!))!.hidden).toBe(false);
  });

  it('lists the loads in the order given with the columns and changes', async () => {
    await render([load(1), load(2, { mode: 'replace', added: 96, removed: 12 }), load(3)]);
    const list = host.querySelector('ul')!;
    expect(list.getAttribute('aria-label')).toBe('Last 10 loads');
    expect(list.firstElementChild!.textContent).toBe('SourceOfficerWhenModeChanges');
    const rows = [...list.querySelectorAll('li')].slice(1);
    expect(rows.map((r) => r.firstElementChild!.textContent)).toEqual(['file-1.json', 'file-2.json', 'file-3.json']);
    expect(rows[0].textContent).toContain('Merge');
    expect(rows[0].textContent).toContain('+1');
    expect(rows[0].textContent).not.toContain('−');
    expect(rows[1].textContent).toContain('Replace');
    expect(rows[1].textContent).toContain('+96 −12');
  });
});
