// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRequirements } from '@/lib/raids';
import { TemplateForm } from './TemplateForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// As the officers' raids page loads it: a template saved in the older four-number shape.
const old = { name: 'Onyxia’s Lair', short: 'Ony', size: 40, durationMin: 60, requirements: parseRequirements({ tank: 3, healer: 12, melee: 11, ranged: 14 }), active: true };

let root: Root, host: HTMLDivElement;
const onSubmit = vi.fn(async () => null);
const render = () => act(async () => root.render(<TemplateForm initial={old} onSubmit={onSubmit} onCancel={() => {}} />));
const boxes = () => [...host.querySelectorAll('fieldset input[type=number]')] as HTMLInputElement[];
const change = (el: HTMLInputElement, value: string) =>
  act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
const submit = () => act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  onSubmit.mockClear();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('TemplateForm requirements', () => {
  it('shows Tank, Healer and DPS, opening an old-shape template with melee and ranged summed', async () => {
    await render();
    expect([...host.querySelectorAll('fieldset label')].map((l) => l.textContent)).toEqual(['Tank', 'Healer', 'DPS']);
    expect(boxes().map((b) => Number(b.value))).toEqual([3, 12, 25]);
    expect(host.querySelector('legend')?.textContent).toContain('· 40 of 40');
  });

  it('saves the three numbers, and names the size when they do not add up', async () => {
    await render();
    await change(boxes()[1], '11');
    expect(host.querySelector('legend')?.textContent).toContain('· 39 of 40');
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host.querySelector('[role=alert]')?.textContent).toBe('Tank, healer and DPS must add up to 40.');
    await change(boxes()[2], '26');
    await submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ requirements: { tank: 3, healer: 11, dps: 26 } }));
  });
});
