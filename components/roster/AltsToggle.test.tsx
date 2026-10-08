// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AltsToggle } from './AltsToggle';

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

describe('AltsToggle', () => {
  it('uses a 44px disclosure button with the supplied panel relationship', async () => {
    const onToggle = vi.fn();
    await act(async () => root.render(<AltsToggle count={2} memberName="Ledgerline" expanded={false} controlsId="alts-member" onToggle={onToggle} label={(count) => `Alts ${count}`} />));

    const button = host.querySelector('button')!;
    expect(button.textContent).toBe('Alts 2');
    expect(button.getAttribute('aria-label')).toBe('Show 2 alts for Ledgerline');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBe('alts-member');
    expect(button.className).toContain('h-11');
    expect(host.querySelector('span')?.className).toContain('rounded-tag');
    expect(host.querySelector('svg')?.getAttribute('class')).toContain('motion-reduce:transition-none');

    await act(async () => button.click());
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
